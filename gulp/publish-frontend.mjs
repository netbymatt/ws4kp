/* eslint-disable import/no-extraneous-dependencies */
import {
	src, dest, series, parallel,
} from 'gulp';
import concat from 'gulp-concat';
import terser from 'gulp-terser';
import ejs from 'gulp-ejs';
import rename from 'gulp-rename';
import htmlmin from 'gulp-htmlmin';
import { deleteAsync } from 'del';
import s3Upload from 'gulp-s3-upload';
import webpack from 'webpack-stream';
import TerserPlugin from 'terser-webpack-plugin';
import { readFile } from 'fs/promises';
import reader from '../src/playlist-reader.mjs';
import file from "gulp-file";

// get cloudfront
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';

const clean = () => deleteAsync(['./dist/**/*', '!./dist/readme.txt']);

const cloudfront = new CloudFrontClient({ region: 'us-east-1' });

const RESOURCES_PATH = './dist/resources';

const jsSourcesData = [
	'server/scripts/data/travelcities.js',
	'server/scripts/data/regionalcities.js',
	'server/scripts/data/stations.js',
];

const webpackOptions = {
	mode: 'production',
	// mode: 'development',
	// devtool: 'source-map',
	output: {
		filename: 'ws.min.js',
	},
	resolve: {
		roots: ['./'],
	},
	optimization: {
		minimize: true,
		minimizer: [
			new TerserPlugin({
				extractComments: false,
				terserOptions: {
					// sourceMap: true,
					format: {
						comments: false,
					},
				},
			}),
		],
	},
};

const compressJsData = () => src(jsSourcesData)
	.pipe(concat('data.min.js'))
	.pipe(terser())
	.pipe(dest(RESOURCES_PATH));

const jsVendorSources = [
	'server/scripts/vendor/auto/jquery.js',
	'server/scripts/vendor/jquery.autocomplete.min.js',
	'server/scripts/vendor/auto/nosleep.js',
	'server/scripts/vendor/auto/swiped-events.js',
	'server/scripts/vendor/auto/suncalc.js',
];

const compressJsVendor = () => src(jsVendorSources)
	.pipe(concat('vendor.min.js'))
	.pipe(terser())
	.pipe(dest(RESOURCES_PATH));

const mjsSources = [
	'server/scripts/modules/currentweatherscroll.mjs',
	'server/scripts/modules/hazards.mjs',
	'server/scripts/modules/currentweather.mjs',
	'server/scripts/modules/almanac.mjs',
	'server/scripts/modules/icons.mjs',
	'server/scripts/modules/extendedforecast.mjs',
	'server/scripts/modules/hourly.mjs',
	'server/scripts/modules/hourly-graph.mjs',
	'server/scripts/modules/latestobservations.mjs',
	'server/scripts/modules/localforecast.mjs',
	'server/scripts/modules/radar.mjs',
	'server/scripts/modules/regionalforecast.mjs',
	'server/scripts/modules/travelforecast.mjs',
	'server/scripts/modules/progress.mjs',
	'server/scripts/modules/media.mjs',
	'server/scripts/index.mjs',
];

const buildJs = () => src(mjsSources)
	.pipe(webpack(webpackOptions))
	.pipe(dest(RESOURCES_PATH));

const cssSources = [
	'server/styles/main.css',
];
const copyCss = () => src(cssSources)
	.pipe(concat('ws.min.css'))
	.pipe(dest(RESOURCES_PATH));

const htmlSources = [
	'views/*.ejs',
];
const compressHtml = async () => {
	const packageJson = await readFile('package.json');
	const { version } = JSON.parse(packageJson);

	return src(htmlSources)
		.pipe(ejs({
			production: version,
			version,
		}))
		.pipe(rename({ extname: '.html' }))
		.pipe(htmlmin({ collapseWhitespace: true }))
		.pipe(dest('./dist'));
};

const otherFiles = [
	'server/robots.txt',
	'server/manifest.json',
	'server/music/**/*.mp3'
];
const copyOtherFiles = () => src(otherFiles, { base: 'server/', encoding: false })
	.pipe(dest('./dist'));

const s3 = s3Upload({
	useIAM: true,
}, {
	region: 'us-east-1',
});
const uploadSources = [
	'dist/**',
	'!dist/**/*.map',
];
const upload = () => src(uploadSources, { base: './dist' })
	.pipe(s3({
		Bucket: 'weatherstar',
		StorageClass: 'STANDARD',
		maps: {
			CacheControl: (keyname) => {
				if (keyname.indexOf('index.html') > -1) return 'max-age=300'; // 10 minutes
				return 'max-age=2592000'; // 1 month
			},
		},
	}));

const imageSources = [
	'server/fonts/**',
	'server/images/**',
];
const uploadImages = () => src(imageSources, { base: './server', encoding: false })
	.pipe(
		s3({
			Bucket: 'weatherstar',
			StorageClass: 'STANDARD',
		}),
	);

const invalidate = () => cloudfront.send(new CreateInvalidationCommand({
	DistributionId: 'E9171A4KV8KCW',
	InvalidationBatch: {
		CallerReference: (new Date()).toLocaleString(),
		Paths: {
			Quantity: 1,
			Items: ['/*'],
		},
	},
}));

const buildPlaylist = async () => {
	const availableFiles = await reader();
	const playlist = { availableFiles };
	return file('playlist.json', JSON.stringify(playlist)).pipe(dest('./dist'))
}

const buildDist = series(clean, parallel(buildJs, compressJsData, compressJsVendor, copyCss, compressHtml, copyOtherFiles, buildPlaylist));

// upload_images could be in parallel with upload, but _images logs a lot and has little changes
// by running upload last the majority of the changes will be at the bottom of the log for easy viewing
const publishFrontend = series(buildDist, uploadImages, upload, invalidate);

export default publishFrontend;

export {
	buildDist,
}
