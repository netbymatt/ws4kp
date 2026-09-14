import { src, series, dest } from 'gulp';
import { deleteAsync } from 'del';
import rename from 'gulp-rename';

const clean = () => deleteAsync(['./server/scripts/vendor/auto/**']);

const vendorFiles = [
	'./node_modules/luxon/build/es6/luxon.mjs',
	'./node_modules/luxon/build/es6/luxon.mjs.map',
	'./node_modules/@zakj/no-sleep/dist/no-sleep.js',
	'./node_modules/suncalc/index.js',
	'./node_modules/swiped-events/src/swiped-events.js',
	'./node_modules/proj4/dist/proj4.js',
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

const updateVendor = series(clean, copy, copyMetar);

export default updateVendor;
