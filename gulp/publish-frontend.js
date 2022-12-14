/* eslint-disable import/no-extraneous-dependencies */
const gulp = require('gulp');
const concat = require('gulp-concat');
const terser = require('gulp-terser');
const ejs = require('gulp-ejs');
const rename = require('gulp-rename');
const htmlmin = require('gulp-htmlmin');
const del = require('del');
const s3Upload = require('gulp-s3-upload');
const webpack = require('webpack-stream');
const TerserPlugin = require('terser-webpack-plugin');
const path = require('path');

const clean = () => del(['./dist**']);

// get cloudfront
const AWS = require('aws-sdk');

AWS.config.update({ region: 'us-east-1' });
const cloudfront = new AWS.CloudFront({ apiVersion: '2020-01-01' });

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
		roots: [path.resolve(__dirname, './')],
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

gulp.task('compress_js_data', () => gulp.src(jsSourcesData)
	.pipe(concat('data.min.js'))
	.pipe(terser())
	.pipe(gulp.dest('./dist/resources')));

const jsVendorSources = [
	'server/scripts/vendor/auto/jquery.js',
	'server/scripts/vendor/jquery.autocomplete.min.js',
	'server/scripts/vendor/auto/nosleep.js',
	'server/scripts/vendor/auto/swiped-events.js',
	'server/scripts/vendor/auto/suncalc.js',
];

gulp.task('compress_js_vendor', () => gulp.src(jsVendorSources)
	.pipe(concat('vendor.min.js'))
	.pipe(terser())
	.pipe(gulp.dest('./dist/resources')));

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
	'server/scripts/index.mjs',
];

gulp.task('build_js', () => gulp.src(mjsSources)
	.pipe(webpack(webpackOptions))
	.pipe(gulp.dest('dist/resources')));

const cssSources = [
	'server/styles/main.css',
];
gulp.task('copy_css', () => gulp.src(cssSources)
	.pipe(concat('ws.min.css'))
	.pipe(gulp.dest('./dist/resources')));

const htmlSources = [
	'views/*.ejs',
];
gulp.task('compress_html', () => {
	// eslint-disable-next-line global-require
	const { version } = require('../package.json');
	return gulp.src(htmlSources)
		.pipe(ejs({
			production: version,
			version,
		}))
		.pipe(rename({ extname: '.html' }))
		.pipe(htmlmin({ collapseWhitespace: true }))
		.pipe(gulp.dest('./dist'));
});

const otherFiles = [
	'server/robots.txt',
	'server/manifest.json',
];
gulp.task('copy_other_files', () => gulp.src(otherFiles, { base: 'server/' })
	.pipe(gulp.dest('./dist')));

const s3 = s3Upload({
	useIAM: true,
}, {
	region: 'us-east-1',
});
const uploadSources = [
	'dist/**',
	'!dist/**/*.map',
];
gulp.task('upload', () => gulp.src(uploadSources, { base: './dist' })
	.pipe(s3({
		Bucket: 'weatherstar',
		StorageClass: 'STANDARD',
		maps: {
			CacheControl: (keyname) => {
				if (keyname.indexOf('index.html') > -1) return 'max-age=300'; // 10 minutes
				return 'max-age=2592000'; // 1 month
			},
		},
	})));

const imageSources = [
	'server/fonts/**',
	'server/images/**',
];
gulp.task('upload_images', () => gulp.src(imageSources, { base: './server' })
	.pipe(
		s3({
			Bucket: 'weatherstar',
			StorageClass: 'STANDARD',
		}),
	));

gulp.task('invalidate', async () => cloudfront.createInvalidation({
	DistributionId: 'E9171A4KV8KCW',
	InvalidationBatch: {
		CallerReference: (new Date()).toLocaleString(),
		Paths: {
			Quantity: 1,
			Items: ['/*'],
		},
	},
}).promise());

// upload_images could be in parallel with upload, but _images logs a lot and has little changes
// by running upload last the majority of the changes will be at the bottom of the log for easy viewing
module.exports = gulp.series(clean, gulp.parallel('build_js', 'compress_js_data', 'compress_js_vendor', 'copy_css', 'compress_html', 'copy_other_files'), 'upload_images', 'upload', 'invalidate');
