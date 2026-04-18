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
import webpack from 'webpack-stream';
import TerserPlugin from 'terser-webpack-plugin';
import { readFile } from 'fs/promises';
import file from 'gulp-file';
import * as dartSass from 'sass';
import gulpSass from 'gulp-sass';
import log from 'fancy-log';
import OVERRIDES from '../src/overrides.mjs';

// get cloudfront
import reader from '../src/playlist-reader.mjs';

const sass = gulpSass(dartSass);

const clean = () => deleteAsync(['./dist/**/*', '!./dist/readme.txt']);

const RESOURCES_PATH = './dist/resources';

// Data is now served as JSON files to avoid redundancy

const webpackOptions = {
	mode: 'production',
	output: {
		filename: '[name].min.js',
	},
	resolve: {
		roots: ['./'],
	},
	devtool: 'source-map',
	entry: {
		index: {
			import: './server/scripts/index.mjs',
			dependOn: 'shared',
		},
		displays: {
			import: [
				'./server/scripts/modules/hazards.mjs',
				'./server/scripts/modules/currentweather.mjs',
				'./server/scripts/modules/almanac.mjs',
				'./server/scripts/modules/spc-outlook.mjs',
				'./server/scripts/modules/extendedforecast.mjs',
				'./server/scripts/modules/hourly.mjs',
				'./server/scripts/modules/hourly-graph.mjs',
				'./server/scripts/modules/latestobservations.mjs',
				'./server/scripts/modules/localforecast.mjs',
				'./server/scripts/modules/radar.mjs',
				'./server/scripts/modules/regionalforecast.mjs',
				'./server/scripts/modules/travelforecast.mjs',
			],
			dependOn: 'shared',
		},
		features: {
			import: [
				'./server/scripts/modules/custom-scroll-text.mjs',
				'./server/scripts/modules/currentweatherscroll.mjs',
				'./server/scripts/modules/media.mjs',
			],
			dependOn: 'shared',
		},
		shared: [
			'./server/scripts/modules/progress.mjs',
			'./server/scripts/modules/settings.mjs',
			'./server/scripts/modules/utils/setting.mjs',
			'./server/scripts/modules/icons.mjs',
			'./server/scripts/modules/utils/cache.mjs',
			'./server/scripts/modules/utils/debug.mjs',
			'./server/scripts/modules/utils/image.mjs',
			'./server/scripts/modules/utils/metar.mjs',
			'./server/scripts/modules/utils/mapclick.mjs',
			'./server/scripts/modules/utils/units.mjs',
		],
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
	'server/scripts/modules/custom-scroll-text.mjs',
	'server/scripts/index.mjs',
];

const buildJs = () => src(mjsSources)
	.pipe(webpack(webpackOptions))
	.pipe(dest(RESOURCES_PATH));

const cssSources = [
	'server/styles/scss/**/*.scss',
];
const buildCss = () => src(cssSources, { sourcemaps: true })
	.pipe(sass({ style: 'compressed' }).on('error', sass.logError))
	.pipe(rename({ suffix: '.min' }))
	.pipe(dest(RESOURCES_PATH, { sourcemaps: '.' }));

const htmlSources = [
	'views/*.ejs',
];

const getVersion = async () => {
	const packageJson = await readFile('package.json');
	const packageVersion = JSON.parse(packageJson).version;

	return process.env.WS4KP_VERSION ?? packageVersion;
};

const compressHtml = async () => {
	const version = await getVersion();
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

const imageSources = [
	'server/fonts/**',
	'server/images/**',
	'!server/images/gimp/**',
];

const copyImageSources = () => src(imageSources, { base: './server', encoding: false })
	.pipe(dest('./dist'));

const buildPlaylist = async () => {
	const availableFiles = await reader();
	const playlist = { availableFiles };
	return file('playlist.json', JSON.stringify(playlist)).pipe(dest('./dist'));
};

const logVersion = async () => {
	log(`Built version: ${await getVersion()}`);
};

const buildDist = series(clean, parallel(buildJs, compressJsVendor, buildCss, compressHtml, copyOtherFiles, copyDataFiles, copyImageSources, buildPlaylist), logVersion);

export default buildDist;

export {
	logVersion,
};
