import 'dotenv/config';
import {
	src, dest, series, parallel,
} from 'gulp';
import ejs from 'gulp-ejs';
import rename from 'gulp-rename';
import htmlmin from 'gulp-html-minifier-terser';
import { deleteAsync } from 'del';
import webpack from 'webpack-stream';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
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

// the app's single entry point, server/scripts/ws.mjs imports every module that registers itself when it loads

const wsModules = [
	'./server/scripts/ws.mjs',
];

const webpackOptions = {
	mode: 'production',
	output: {
		filename: '[name].min.js',
	},
	devtool: 'source-map',
	entry: {
		ws: wsModules,
	},
	// the single bundle is over webpack's default 244 KiB limit, so warn when it grows past this instead
	performance: {
		maxAssetSize: 450 * 1024,
		maxEntrypointSize: 450 * 1024,
	},
	module: {
		rules: [{
			// the vendor files are UMD or plain scripts; treated as ES modules, proj4 sets its global the same way it does in the browser
			test: /[\\/]vendor[\\/]auto[\\/](proj4|swiped-events)\.js$/,
			type: 'javascript/esm',
		}],
	},
};
// webpack-stream takes its entry from the config, the files here only start the stream
const buildJs = () => src(wsModules, { read: false })
	.pipe(webpack(webpackOptions))
	.pipe(dest(RESOURCES_PATH));

const cssSources = [
	'server/styles/scss/ws.scss',
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
			production: true,
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
	'server/apple-touch-icon.png',
	'server/favicon.ico',
	'server/.well-known/security.txt',
	// optional custom scripts the page loads from scripts/, so static hosting and both Docker images include them
	'server/scripts/custom*.*',
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
];

const copyImageSources = () => src(imageSources, { base: './server', encoding: false })
	.pipe(dest('./dist'));

const buildPlaylist = async () => {
	const availableFiles = await reader();
	const playlist = { availableFiles };
	// dist doesn't exist yet in a fresh checkout or a Docker build, and the tasks that create it run in parallel with this one
	await mkdir('./dist', { recursive: true });

	await writeFile('./dist/playlist.json', JSON.stringify(playlist));
};

const logVersion = async () => {
	log(`Built version: ${await getVersion()}`);
};

const buildDist = series(clean, parallel(buildJs, buildCss, compressHtml, copyOtherFiles, copyDataFiles, copyImageSources, buildPlaylist), logVersion);

export default buildDist;

export {
	logVersion,
};
