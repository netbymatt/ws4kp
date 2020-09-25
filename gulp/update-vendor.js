const gulp = require('gulp');
const del = require('del');
const rename = require('gulp-rename');

const clean = (cb) => {
	del(['./server/scripts/vendor/auto/**']);
	cb();
};

const vendor_files = [
	'./node_modules/luxon/build/global/luxon.js',
	'./node_modules/nosleep.js/dist/NoSleep.js',
	'./node_modules/jquery/dist/jquery.js',
	'./node_modules/suncalc/suncalc.js',
];

const copy = () => gulp.src(vendor_files)
	.pipe(rename((path) => {
		path.dirname = path.dirname.toLowerCase();
		path.basename = path.basename.toLowerCase();
		path.extname = path.extname.toLowerCase();
	}))
	.pipe(gulp.dest('./server/scripts/vendor/auto'));


module.exports = gulp.series(clean, copy);