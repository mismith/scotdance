// config
var PROXY_ADDR = '',
	BASE_PATH  = '',
	ASSET_PATH = BASE_PATH + 'assets';

var config = {
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
	names: {
		js: 'base.js',
	},
	globs: {
		html: [
			'**/*.+(html|php)',
		],
		js: [
			ASSET_PATH + '/scripts/*/**/*.js',
			ASSET_PATH + '/scripts/**/*.js',
		],
		less: [
			ASSET_PATH + '/styles/**/*.less',
		],
		refresh: [
			'**/.htaccess',
			'**/*.+(html|php|jpg|jpeg|gif|png|svg)',
		],
		excludes: [
			'!**/node_modules/**/*',
			'!**/vendor/**/*',
			'!**/wp/**/*',
		],
	},
	dests: {
		js:   ASSET_PATH + '/js',
		less: ASSET_PATH + '/css',
	}
};

// includes
var gulp         = require('gulp'),
	gutil        = require('gulp-util'),
	argv         = require('yargs').argv,
	rename       = require('gulp-rename'),
	notifier     = require('node-notifier'),
	
	// watching
	browserSync  = require('browser-sync'),
		
	// html
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

// tasks
gulp
	// build
	.task('html', function(){
		gulp.src(config.globs.html.concat(config.globs.excludes))
			.pipe(htmlhint(config.htmlhint))
			.pipe(htmlhint.reporter());
	})
	.task('js', function(){
		gulp.src(config.globs.js.concat(config.globs.excludes))
			.pipe(jsValidate()).on('error', handleError)
			.pipe(concat(config.names.js))
			.pipe(ngAnnotate()).on('error', handleError)
			.pipe(gulp.dest(config.dests.js))
			
			.pipe(rename({suffix: '.min'}))
			.pipe(uglify()).on('error', handleError)
			.pipe(gulp.dest(config.dests.js))
			
			.pipe(browserSync.reload({stream: true}));
	})
	.task('less', function(){
		gulp.src(config.globs.less.concat(config.globs.excludes).concat('!' + ASSET_PATH + '/styles/**/*.inc.less')) // append this here so that these files are still watched for changes, they just don't get compiled/output
			.pipe(less()).on('error', handleError)
			.pipe(autoprefixer(config.autoprefixer))
			.pipe(minifyCss())
			.pipe(gulp.dest(config.dests.less))
			
			.pipe(browserSync.reload({stream: true}));
	})
	.task('build', ['js','less'])
	
	
	// watch
	.task('html.watch', ['html'], function(){
		gulp.watch(config.globs.html.concat(config.globs.excludes), ['html']);
	})
	.task('js.watch', ['js'], function(){
		gulp.watch(config.globs.js.concat(config.globs.excludes), ['js']);
	})
	.task('less.watch', ['less'], function(){
		gulp.watch(config.globs.less.concat(config.globs.excludes), ['less']);
	})
	.task('watch', ['html.watch','js.watch','less.watch'], function(){
		var options = {
			files: config.globs.refresh.concat(config.globs.excludes),
			watchOptions: {debounce: 400},
			ghostMode: argv.g || gutil.env.ghost, // call `gulp -g` or `gulp --ghost` to start in ghostMode
			notify: false,
			open: ! argv.s && ! gutil.env.silent, // call `gulp -s` or `gulp --silent` to start gulp without opening a new browser window
		};
		if(PROXY_ADDR){
			options.proxy = PROXY_ADDR;
		}else{
			// N.B. this doesn't work with HTML5 URL rewriting
			options.server = { 
				baseDir: './' + BASE_PATH,
			};
		}
		browserSync.init(options);
	})
	
	
	// default
	.task('default', ['watch']);