import { src, series, dest } from 'gulp';
import { deleteAsync } from 'del';
import rename from 'gulp-rename';
import webpack from 'webpack';
import { resolve as resolvePath } from 'node:path';

const clean = () => deleteAsync(['./server/scripts/vendor/auto/**']);

const vendorFiles = [
	'./node_modules/luxon/build/es6/luxon.mjs',
	'./node_modules/luxon/build/es6/luxon.mjs.map',
	'./node_modules/@zakj/no-sleep/dist/no-sleep.js',
	'./node_modules/suncalc/index.js',
	'./node_modules/swiped-events/src/swiped-events.js',
];

// Special handling for metar-taf-parser - only copy main file and English locale
const metarFiles = [
	'./node_modules/metar-taf-parser/metar-taf-parser.js',
	'./node_modules/metar-taf-parser/locale/en.js',
];

const copy = () => src(vendorFiles)
	.pipe(rename((path, file) => {
		path.dirname = path.dirname.toLowerCase();
		path.basename = path.basename.toLowerCase();
		path.extname = path.extname.toLowerCase();
		if (file.base.includes('suncalc')) path.basename = 'suncalc';
	}))
	.pipe(dest('./server/scripts/vendor/auto'));

const copyMetar = () => src(metarFiles, { base: './node_modules/metar-taf-parser' })
	.pipe(rename((path) => {
		path.basename = path.basename.toLowerCase();
		path.extname = path.extname.toLowerCase();
		if (path.basename === 'metar-taf-parser') path.extname = '.mjs';
	}))
	.pipe(dest('./server/scripts/vendor/auto'));

// proj4 is built with only the projections the app uses, see gulp/proj4-minimal.mjs
// the result is a plain script that sets the proj4 global, the same as proj4's own browser build
const buildProj4 = () => new Promise((resolve, reject) => {
	webpack({
		mode: 'production',
		entry: './gulp/proj4-minimal.mjs',
		output: {
			path: resolvePath('./server/scripts/vendor/auto'),
			filename: 'proj4.js',
		},
		devtool: false,
		performance: { hints: false },
	}, (err, stats) => {
		if (err) {
			reject(err);
			return;
		}
		if (stats.hasErrors()) {
			reject(new Error(stats.toString('errors-only')));
			return;
		}
		resolve();
	});
});

const updateVendor = series(clean, copy, copyMetar, buildProj4);

export default updateVendor;
