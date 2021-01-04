const gulp = require('gulp');
const bump = require('gulp-bump');

gulp.task('update-vendor', require('./gulp/update-vendor'));
gulp.task('publish-frontend', require('./gulp/publish-frontend'));

gulp.task('bump_patch', () => gulp.src('./package.json')
	.pipe(bump())
	.pipe(gulp.dest('./')));

gulp.task('bump_minor', () => gulp.src('./package.json')
	.pipe(bump({ type: 'minor' }))
	.pipe(gulp.dest('./')));

gulp.task('bump_major', () => gulp.src('./package.json')
	.pipe(bump({ type: 'major' }))
	.pipe(gulp.dest('./')));
