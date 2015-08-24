// includes
var gulp         = require('gulp'),

	// build
	fs           = require('fs'),
	merge        = require('merge');

	// utility
	gutil        = require('gulp-util'),
	argv         = require('yargs').argv,
	rename       = require('gulp-rename'),
	notifier     = require('node-notifier'),
	
	// watching
	browserSync  = require('browser-sync'),
	historyApiFallback = require('connect-history-api-fallback'),
	
	// caching
	manifest     = require('gulp-manifest'),
	
	// linting
	htmlhint     = require('gulp-htmlhint'),
		
	// js
	concat       = require('gulp-concat'),
	uglify       = require('gulp-uglify'),
	jsValidate   = require('gulp-jsvalidate'),
	ngAnnotate   = require('gulp-ng-annotate'),
	
	// css
	less         = require('gulp-less'),
	autoprefixer = require('gulp-autoprefixer'),
	minifyCss    = require('gulp-minify-css');


// config
var defaults = {
	autoprefixer: 'last 2 versions',
	htmlhint: {
		"doctype-first": false,
		"spec-char-escape": false,
		"attr-lowercase": false,
		"tagname-lowercase": false,
		"img-alt-require": true,
		"attr-unsafe-chars": true,
		"space-tab-mixed-disabled": true,
	},
	manifest: {
		basePath: __dirname.replace(/[^\w\s]/g, "\\$&"),
		filename: 'cache.manifest',
		exclude: 'cache.manifest',
		//preferOnline: true,
		hash: true,
	},
	browsersync: {
		ui: false,
		watchOptions: {debounce: 400},
		reloadDebounce: 400,
		notify: false,
		server: { 
			baseDir: './',
			middleware: [ historyApiFallback() ],
		},
		//proxy: 'example.dev',
	},
	concat: {
		js: 'base',
	},
	globs: {
		excludes: [
			'!**/node_modules/**/*',
			'!**/vendor/**/*',
			'!**/wp/**/*',
		],
		html: [
			'**/*.{html,htm,php}',
		],
		js: [
			'assets/scripts/*/**/*.js', // subfolders first
			'assets/scripts/**/*.js',
		],
		less: [
			'assets/styles/**/*.less',
			// note that files ending in ".inc.less" will not be compiled (but they will be watched)
		],
		files: [
			'**/*.{htaccess,jpg,jpeg,gif,png,svg}',
		],
		manifest: [
			'assets/js/*',
			'assets/css/*',
			'assets/img/*.{jpg,jpeg,gif,png,svg}',
			'*.{html}',
		],
	},
	dests: {
		js:   'assets/js',
		less: 'assets/css',
	}
};
var gulpconfig = './gulpfile.config.js';
var config = merge.recursive(defaults, fs.existsSync(gulpconfig) ? require(gulpconfig) : {});
var concatIf = function (array, toConcat, ifCondition) {
	if (ifCondition) {
		array = array.concat(toConcat);
		console.log(array);
	}
	return array;
};


// tasks
gulp
	// build
	.task('html', function(){
		gulp.src(config.globs.html.concat(config.globs.excludes))
		
			.pipe(browserSync.reload({stream: true}));
	})
	.task('js', function(){
		gulp.src(config.globs.js.concat(config.globs.excludes))
			.pipe(jsValidate()).on('error', handleError)
			.pipe(ngAnnotate()).on('error', handleError)
			.pipe(concat(config.concat.js + '.js'))
			.pipe(gulp.dest(config.dests.js))
			
			.pipe(rename({suffix: '.min'}))
			.pipe(uglify()).on('error', handleError)
			.pipe(gulp.dest(config.dests.js))
			
			.pipe(browserSync.reload({stream: true}));
	})
	.task('less', function(){
		gulp.src(config.globs.less.concat(config.globs.excludes).concat('!**/*.inc.less')) // don't output .inc.less files as they are never accessed directly
			.pipe(less()).on('error', handleError)
			.pipe(autoprefixer(config.autoprefixer))
			.pipe(minifyCss())
			.pipe(gulp.dest(config.dests.less))
			
			.pipe(browserSync.reload({stream: true}));
	})
	.task('manifest', function(){
		gulp.src(config.globs.manifest.concat(config.globs.excludes))
			.pipe(manifest(config.manifest))
			
			.pipe(gulp.dest(''));
	})
	.task('build', concatIf(['html','js','less'], 'manifest', argv.m || gutil.env.manifest))
	
	// lint
	.task('html.lint', function(){
		gulp.src(config.globs.html.concat(config.globs.excludes))
			.pipe(htmlhint(config.htmlhint))
			.pipe(htmlhint.reporter());
	})
	// watch
	.task('html.watch', function(){
		gulp.watch(config.globs.html.concat(config.globs.excludes), ['html']);
	})
	.task('js.watch', function(){
		gulp.watch(config.globs.js.concat(config.globs.excludes), ['js']);
	})
	.task('less.watch', function(){
		gulp.watch(config.globs.less.concat(config.globs.excludes), ['less']);
	})
	.task('manifest.watch', function(){
		gulp.watch(config.globs.manifest.concat(config.globs.excludes), ['manifest']);
	})
	.task('watch', concatIf(['html.watch','js.watch','less.watch'], 'manifest.watch', argv.m || gutil.env.manifest), function(){
		browserSync.init(merge.recursive(config.browsersync || {}, {
			files: config.globs.files.concat(config.globs.excludes),
			ghostMode: !! (argv.g || gutil.env.ghost), // call `gulp -g` or `gulp --ghost` to start in ghostMode
			open: ! (argv.s || gutil.env.silent), // call `gulp -s` or `gulp --silent` to start gulp without opening a new browser window
		}));
	})
	
	
	// default
	.task('default', ['watch']);


// error handling
var handleError = function(error, type){
	//console.log(error);
	
	// remove any leading error marker
	error.message = error.message.replace(/^error:\s*/i, '');
	
	// shorten fileName
	var fileName = error.fileName ? error.fileName.replace(__dirname, '') : '';
	
	// show an OS-level notification to make sure we catch our attention
	// (do this before we format things since it can't handle the formatting)
	notifier.notify({
		title: 'ERROR(' + error.plugin + ')',
		subtitle: fileName,
		message: error.message,
		sound: 'Basso',
		activate: 'com.apple.Terminal',
	});
	
	// colour the problematic line for higher visibility
	if(error.extract){
		var middleIndex = Math.floor(error.extract.length / 2);
		error.extract[middleIndex] = gutil.colors.red(error.extract[middleIndex]);
	}
	// append highlighted fileName to message, if not already there
	if(fileName){
		if(error.message.indexOf(error.fileName) >= 0){
			error.message = error.message.replace(error.fileName, gutil.colors.magenta(fileName));
		}else{
			error.message += ' in ' + gutil.colors.magenta(fileName);
		}
	}
	// process line numbers
	var line = error.lineNumber || error.line;
	
	// output the formatted error
	gutil.log(
		// error and plugin
		gutil.colors.red('ERROR(' + error.plugin + '): ') +
		
		// message
		error.message +
		
		// offending line number and column
		(line ? ' [' + gutil.colors.cyan(line) + ':' + gutil.colors.cyan(error.column) + ']' : '') +
		
		// preview the offending code
		(error.extract ? '\n\n\t' + error.extract.join('\n\t') : '') +
		
		// finish with a new line
		'\n'
	);
	
	// prevent this error from breaking/stopping watchers
	this.emit('end');
};