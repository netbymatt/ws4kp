/* eslint-disable import/no-extraneous-dependencies */
import { src, series, dest } from 'gulp';
import { deleteAsync } from 'del';
import rename from 'gulp-rename';

const clean = () => deleteAsync(['./server/scripts/vendor/auto/**']);

const vendorFiles = [
	'./node_modules/luxon/build/es6/luxon.js',
	'./node_modules/luxon/build/es6/luxon.js.map',
	'./node_modules/nosleep.js/dist/NoSleep.js',
	'./node_modules/suncalc/suncalc.js',
	'./node_modules/swiped-events/src/swiped-events.js',
];

const copy = () => src(vendorFiles)
	.pipe(rename((path) => {
		path.dirname = path.dirname.toLowerCase();
		path.basename = path.basename.toLowerCase();
		path.extname = path.extname.toLowerCase();
		if (path.basename === 'luxon') path.extname = '.mjs';
	}))
	.pipe(dest('./server/scripts/vendor/auto'));

const updateVendor = series(clean, copy);

export default updateVendor;
