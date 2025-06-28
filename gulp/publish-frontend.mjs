/* eslint-disable import/no-extraneous-dependencies */
import 'dotenv/config';
import {
	src, dest, series, parallel,
} from 'gulp';
import concat from 'gulp-concat';
import terser from 'gulp-terser';
import ejs from 'gulp-ejs';
import rename from 'gulp-rename';
import htmlmin from 'gulp-html-minifier-terser';
import { deleteAsync } from 'del';
import s3Upload from 'gulp-s3-uploader';
import webpack from 'webpack-stream';
import TerserPlugin from 'terser-webpack-plugin';
import { readFile } from 'fs/promises';
import file from 'gulp-file';
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import OVERRIDES from '../src/overrides.mjs';

// get cloudfront
import reader from '../src/playlist-reader.mjs';

const clean = () => deleteAsync(['./dist/**/*', '!./dist/readme.txt']);

const cloudfront = new CloudFrontClient({ region: 'us-east-1' });

const RESOURCES_PATH = './dist/resources';

// Data is now served as JSON files to avoid redundancy

const webpackOptions = {
	mode: 'production',
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

const jsVendorSources = [
	'server/scripts/vendor/auto/nosleep.js',
	'server/scripts/vendor/auto/swiped-events.js',
	'server/scripts/vendor/auto/suncalc.js',
];

// Copy metar-taf-parser separately since it's an ES module with locale dependencies
const metarVendorSources = [
	'server/scripts/vendor/auto/metar-taf-parser.mjs',
	'server/scripts/vendor/auto/locale/en.js',
];

const copyMetarVendor = () => src(metarVendorSources, { base: 'server/scripts/vendor/auto' })
	.pipe(dest(`${RESOURCES_PATH}/vendor/auto`));

const compressJsVendor = () => src(jsVendorSources)
	.pipe(concat('vendor.min.js'))
	.pipe(terser())
	.pipe(dest(RESOURCES_PATH));

const mjsSources = [
	'server/scripts/modules/currentweatherscroll.mjs',
	'server/scripts/modules/hazards.mjs',
	'server/scripts/modules/currentweather.mjs',
	'server/scripts/modules/almanac.mjs',
	'server/scripts/modules/spc-outlook.mjs',
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
			serverAvailable: false,
			version,
			OVERRIDES,
			query: {},
		}))
		.pipe(rename({ extname: '.html' }))
		.pipe(htmlmin({ collapseWhitespace: true }))
		.pipe(dest('./dist'));
};

const otherFiles = [
	'server/robots.txt',
	'server/manifest.json',
	'server/music/**/*.mp3',
];
const copyOtherFiles = () => src(otherFiles, { base: 'server/', encoding: false })
	.pipe(dest('./dist'));

// Copy JSON data files for static hosting
const copyDataFiles = () => src([
	'datagenerators/output/travelcities.json',
	'datagenerators/output/regionalcities.json',
	'datagenerators/output/stations.json',
]).pipe(dest('./dist/data'));

const s3 = s3Upload({
	useIAM: true,
}, {
	region: 'us-east-1',
});
const uploadSources = [
	'dist/**',
	'!dist/**/*.map',
	'!dist/images/**/*',
	'!dist/fonts/**/*',
];

const uploadCreator = (bucket) => () => src(uploadSources, { base: './dist', encoding: false })
	.pipe(s3({
		Bucket: bucket,
		StorageClass: 'STANDARD',
		maps: {
			CacheControl: (keyname) => {
				if (keyname.indexOf('index.html') > -1) return 'max-age=300'; // 10 minutes
				if (keyname.indexOf('.mp3') > -1) return 'max-age=31536000'; // 1 year for mp3 files
				return 'max-age=2592000'; // 1 month
			},
		},
	}));

const imageSources = [
	'server/fonts/**',
	'server/images/**',
	'!server/images/gimp/**',
];

const upload = uploadCreator(process.env.BUCKET);
const uploadPreview = uploadCreator(process.env.BUCKET_PREVIEW);

const uploadImagesCreator = (bucket) => () => src(imageSources, { base: './server', encoding: false })
	.pipe(
		s3({
			Bucket: bucket,
			StorageClass: 'STANDARD',
			maps: {
				CacheControl: () => 'max-age=31536000',
			},
		}),
	);

const uploadImages = uploadImagesCreator(process.env.BUCKET);
const uploadImagesPreview = uploadImagesCreator(process.env.BUCKET_PREVIEW);

const copyImageSources = () => src(imageSources, { base: './server', encoding: false })
	.pipe(dest('./dist'));

const invalidateCreator = (distributionId) => () => cloudfront.send(new CreateInvalidationCommand({
	DistributionId: distributionId,
	InvalidationBatch: {
		CallerReference: (new Date()).toLocaleString(),
		Paths: {
			Quantity: 1,
			Items: ['/*'],
		},
	},
}));

const invalidate = invalidateCreator(process.env.DISTRIBUTION_ID);
const invalidatePreview = invalidateCreator(process.env.DISTRIBUTION_ID_PREVIEW);

const buildPlaylist = async () => {
	const availableFiles = await reader();
	const playlist = { availableFiles };
	return file('playlist.json', JSON.stringify(playlist)).pipe(dest('./dist'));
};

const buildDist = series(clean, parallel(buildJs, compressJsVendor, copyMetarVendor, copyCss, compressHtml, copyOtherFiles, copyDataFiles, copyImageSources, buildPlaylist));

// upload_images could be in parallel with upload, but _images logs a lot and has little changes
// by running upload last the majority of the changes will be at the bottom of the log for easy viewing
const publishFrontend = series(buildDist, uploadImages, upload, invalidate);
const stageFrontend = series(buildDist, uploadImagesPreview, uploadPreview, invalidatePreview);

export default publishFrontend;

export {
	buildDist,
	invalidate,
	stageFrontend,
};
