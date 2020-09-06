const version = '2.2.0';

const gulp = require('gulp');
const concat = require('gulp-concat');
const terser = require('gulp-terser');
const cleanCSS = require('gulp-clean-css');
const ejs = require('gulp-ejs');
const rename = require('gulp-rename');
const htmlmin = require('gulp-htmlmin');
const del = require('del');
const s3Upload = require('gulp-s3-upload');

gulp.task('clean', () =>
	del(['./dist**']),
);

const js_sources = [
	'server/scripts/vendor/jquery-3.5.1.min.js',
	'server/scripts/vendor/libgif.js',
	'server/scripts/vendor/luxon.js',
	'server/scripts/vendor/suncalc.js',
	'server/scripts/data/travelcities.js',
	'server/scripts/data/regionalcities.js',
	'server/scripts/data/stations.js',
	'server/scripts/modules/draw.js',
	'server/scripts/modules/weatherdisplay.js',
	'server/scripts/modules/icons.js',
	'server/scripts/modules/utilities.js',
	'server/scripts/modules/currentweather.js',
	'server/scripts/modules/latestobservations.js',
	'server/scripts/modules/travelforecast.js',
	'server/scripts/modules/regionalforecastdata.js',
	'server/scripts/modules/regionalforecast.js',
	'server/scripts/modules/localforecast.js',
	'server/scripts/modules/extendedforecast.js',
	'server/scripts/modules/almanac.js',
	'server/scripts/modules/radar.js',
	'server/scripts/modules/navigation.js',
];
gulp.task('compress_js', () =>
	gulp.src(js_sources)
		.pipe(concat('ws.min.js'))
		.pipe(terser())
		.pipe(gulp.dest('./dist/resources')),
);

const css_sources = [
	'server/styles/*.css',
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
		}))
		.pipe(rename({extname: '.html'}))
		.pipe(htmlmin({collapseWhitespace: true}))
		.pipe(gulp.dest('./dist')),
);

const other_files = [
	'server/robots.txt',
	'server/manifest.json',
	'server/scripts/index.js',
	'server/scripts/data/states.js',
	'server/scripts/vendor/jquery-3.5.1.min.js',
	'server/scripts/vendor/jquery.autocomplete.min.js',
	'server/scripts/vendor/nosleep.min.js',
	'server/scripts/vendor/jquery.touchSwipe.min.js',
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
					if (keyname.indexOf('twc3.html') > -1) return 'max-age=300'; // 10 minutes
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

module.exports = gulp.series('clean', gulp.parallel('compress_js','compress_css', 'compress_html', 'copy_other_files'), 'upload', 'invalidate');