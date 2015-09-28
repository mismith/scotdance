// includes
var gulp         = require('gulp'),

	// build
	fs           = require('fs'),
	merge        = require('merge'),

	// utility
	gutil        = require('gulp-util'),
	argv         = require('yargs').argv,

	// watching
	browserSync  = require('browser-sync'),

	// js
	concat       = require('gulp-concat'),
	rename       = require('gulp-rename'),
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
		preferOnline: true,
		hash: true,
	},
	browsersync: {
		ui: false,
		watchOptions: {debounce: 400},
		reloadDebounce: 400,
		notify: false,
		server: {
			baseDir: './',
			middleware: [ require('connect-history-api-fallback')() ],
		},
		//proxy: 'example.dev',
	},
	concat: {
		js: 'base',
	},
	globs: {
		excludes: [
			'!node_modules/',
			'!vendor/',
			'!wp/',
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
			'assets/fonts/*',
			'assets/webfonts/*',
			'assets/img/*.{jpg,jpeg,gif,png,svg}',
			'assets/**/*.{mp3,mp4,m4a,m4v,wav,flv,ogg,ogv,webm}',
			'**/*.{html,htm,php}',
		],
	},
	dests: {
		js:   'assets/js',
		less: 'assets/css',
	}
};
var configPath = './gulpfile.config.js',
	config     = merge.recursive(defaults, fs.existsSync(configPath) ? require(configPath) : {});


// tasks
gulp
	// build
	.task('html', function(){
		return gulp.src(config.globs.html.concat(config.globs.excludes))
			.pipe(browserSync.reload({stream: true}));
	})
	.task('rev', function(){
		return gulp.src(config.globs.html.concat(config.globs.excludes))
			.pipe(require('gulp-rev-append')())
			.pipe(gulp.dest('.'))
	})
	.task('js', function(){
		return gulp.src(config.globs.js.concat(config.globs.excludes))
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
		return gulp.src(config.globs.less.concat(config.globs.excludes).concat('!**/*.inc.less')) // don't output .inc.less files as they are never accessed directly
			.pipe(less()).on('error', handleError)
			.pipe(autoprefixer(config.autoprefixer))
			.pipe(minifyCss())
			.pipe(gulp.dest(config.dests.less))
			
			.pipe(browserSync.reload({stream: true}));
	})
	.task('manifest', function(){
		return gulp.src(config.globs.manifest.concat(config.globs.excludes))
			.pipe(require('gulp-manifest')(config.manifest))
			.pipe(gulp.dest('.'));
	})
	.task('build', ['html','rev','js','less','manifest'])
	
	// lint
	.task('html.lint', function(){
		return gulp.src(config.globs.html.concat(config.globs.excludes))
			.pipe(require('gulp-htmlhint')(config.htmlhint))
			.pipe(htmlhint.reporter());
	})
	.task('lint', ['html.lint'])
	
	// watch
	.task('html.watch', function(){
		return gulp.watch(config.globs.html.concat(config.globs.excludes), ['html']);
	})
	.task('js.watch', function(){
		return gulp.watch(config.globs.js.concat(config.globs.excludes), ['js']);
	})
	.task('less.watch', function(){
		return gulp.watch(config.globs.less.concat(config.globs.excludes), ['less']);
	})
	.task('watch', ['html.watch','js.watch','less.watch'], function(){
		var options = merge.recursive(config.browsersync || {}, {
			files:     config.globs.files.concat(config.globs.excludes),
			ghostMode: !! (argv.g || gutil.env.ghost), // call `gulp -g` or `gulp --ghost` to start in ghostMode
			open:      ! (argv.s || gutil.env.silent), // call `gulp -s` or `gulp --silent` to start gulp without opening a new browser window
		});
		if (options.proxy) delete options.server; // prefer proxy to server
		browserSync.init(options);
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
	require('node-notifier').notify({
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