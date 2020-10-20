const version = require('../version');

const gulp = require('gulp');
const concat = require('gulp-concat');
const terser = require('gulp-terser');
const cleanCSS = require('gulp-clean-css');
const ejs = require('gulp-ejs');
const rename = require('gulp-rename');
const htmlmin = require('gulp-htmlmin');
const del = require('del');
const s3Upload = require('gulp-s3-upload');

const clean = () =>
	del(['./dist**']);

const js_sources_data = [
	'server/scripts/data/travelcities.js',
	'server/scripts/data/regionalcities.js',
	'server/scripts/data/stations.js',
	'server/scripts/data/states.js',
];
gulp.task('compress_js_data', () =>
	gulp.src(js_sources_data)
		.pipe(concat('data.min.js'))
		.pipe(terser())
		.pipe(gulp.dest('./dist/resources')),
);

const js_sources = [
	'server/scripts/vendor/auto/jquery.js',
	'server/scripts/vendor/jquery.autocomplete.min.js',
	'server/scripts/vendor/auto/nosleep.js',
	'server/scripts/vendor/auto/swiped-events.js',
	'server/scripts/index.js',
	'server/scripts/libgif.js',
	'server/scripts/vendor/auto/luxon.js',
	'server/scripts/vendor/auto/suncalc.js',
	'server/scripts/modules/draw.js',
	'server/scripts/modules/weatherdisplay.js',
	'server/scripts/modules/icons.js',
	'server/scripts/modules/utilities.js',
	'server/scripts/modules/currentweather.js',
	'server/scripts/modules/currentweatherscroll.js',
	'server/scripts/modules/latestobservations.js',
	'server/scripts/modules/travelforecast.js',
	'server/scripts/modules/regionalforecast.js',
	'server/scripts/modules/localforecast.js',
	'server/scripts/modules/extendedforecast.js',
	'server/scripts/modules/almanac.js',
	'server/scripts/modules/radar.js',
	'server/scripts/modules/hourly.js',
	'server/scripts/modules/progress.js',
	'server/scripts/modules/navigation.js',
];
gulp.task('compress_js', () =>
	gulp.src(js_sources)
		.pipe(concat('ws.min.js'))
		.pipe(terser())
		.pipe(gulp.dest('./dist/resources')),
);

const css_sources = [
	'server/styles/index.css',
];
gulp.task('compress_css', () =>
	gulp.src(css_sources)
		.pipe(concat('ws.min.css'))
		.pipe(cleanCSS())
		.pipe(gulp.dest('./dist/resources')),
);

const html_sources = [
	'views/*.ejs',
];
gulp.task('compress_html', () =>
	gulp.src(html_sources)
		.pipe(ejs({
			production: version,
			version,
		}))
		.pipe(rename({extname: '.html'}))
		.pipe(htmlmin({collapseWhitespace: true}))
		.pipe(gulp.dest('./dist')),
);

const other_files = [
	'server/robots.txt',
	'server/manifest.json',
];
gulp.task('copy_other_files', () =>
	gulp.src(other_files, {base: 'server/'})
		.pipe(gulp.dest('./dist')),
);

const s3 = s3Upload({
	useIAM: true,
},{
	region: 'us-east-1',
});
const upload_sources = [
	'dist/**',
];
gulp.task('upload', () =>
	gulp.src(upload_sources, {base: './dist'})
		.pipe(s3({
			Bucket: 'weatherstar',
			StorageClass: 'STANDARD',
			maps: {
				CacheControl: (keyname) => {
					if (keyname.indexOf('index.html') > -1) return 'max-age=300'; // 10 minutes
					return 'max-age=2592000'; // 1 month
				},
			},
		})),
);

gulp.task('invalidate', async () => {
	// get cloudfront
	const AWS = require('aws-sdk');
	AWS.config.update({region: 'us-east-1'});
	const cloudfront = new AWS.CloudFront({apiVersion: '2020-01-01'});

	return cloudfront.createInvalidation({
		DistributionId: 'E9171A4KV8KCW',
		InvalidationBatch: {
			CallerReference: (new Date()).toLocaleString(),
			Paths: {
				Quantity: 1,
				Items: ['/*'],
			},
		},
	}).promise();
});

module.exports = gulp.series(clean, gulp.parallel('compress_js','compress_js_data','compress_css','compress_html', 'copy_other_files'), 'upload', 'invalidate');