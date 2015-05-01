'use strict';

// defaults, used
var DEFAULT_PLATFORM = 'ios'; // e.g. 'android'/'ios'
var DEFAULT_DEVICE = ''; // e.g. 'iPhone-4s'
// paths used for cordova builds
var CORDOVA_PATH = 'dist'; // location of the cordova project
var DEPLOY_PATH = CORDOVA_PATH + '/www'; // compiled project location used when cordova deploys to target device


// Include Gulp & Tools We'll Use
var gulp = require('gulp');
var $ = require('gulp-load-plugins')();
var del = require('del');
var runSequence = require('run-sequence');
var browserSync = require('browser-sync');
var pagespeed = require('psi');
var reload = browserSync.reload;
var merge = require('merge-stream');
var path = require('path');
var shell = require('gulp-shell');
var argv = require('yargs').argv;

// set up instructions for cordova plugins install using 'gulp plugins' task
var plugins = require('./' + CORDOVA_PATH + '/plugins/fetch.json');
var pluginInstructions = Object.keys(plugins).map(
  function(s){ return('echo; cordova plugin add '+s); }
);

var platform = argv.platform || DEFAULT_PLATFORM;
var device = argv.target || argv.device;
var deviceParam = '';

// set up '--target devicename' param for cordova deploys (if it was passed)
if (device === true) { // only --target option given, use default device
  deviceParam = ' --target ' + DEFAULT_DEVICE;
} else if (device !== undefined) { // use --target with given device name
  deviceParam = ' --target ' + device;
}

var AUTOPREFIXER_BROWSERS = [
  'ie >= 10',
  'ie_mob >= 10',
  'ff >= 30',
  'chrome >= 34',
  'safari >= 7',
  'opera >= 23',
  'ios >= 7',
  'android >= 4.4',
  'bb >= 10'
];

var styleTask = function (stylesPath, srcs) {
  return gulp.src(srcs.map(function(src) {
      return path.join('app', stylesPath, src);
    }))<% if (includeSass) {%>
    .pipe($.changed(stylesPath, {extension: '.scss'}))<% } else {%>
    .pipe($.changed(stylesPath, {extension: '.css'}))<% } %><% if (includeSass && includeLibSass) {%>
    .pipe($.sourcemaps.init())
      .pipe($.sass({
        onError: console.error.bind(console)
      }))
    .pipe($.sourcemaps.write())
    <% } else if (includeSass && includeRubySass) { %>
    .pipe($.rubySass({
        style: 'expanded',
        precision: 10
      })
      .on('error', console.error.bind(console))
    )<% } %>
    .pipe($.autoprefixer(AUTOPREFIXER_BROWSERS))
    .pipe(gulp.dest('.tmp/' + stylesPath))
    .pipe($.if('*.css', $.cssmin()))
    .pipe(gulp.dest(DEPLOY_PATH + '/' + stylesPath))
    .pipe($.size({title: stylesPath}));
};

// Compile and Automatically Prefix Stylesheets
gulp.task('styles', function () {
  return styleTask('styles', ['**/*.css'<% if (includeSass) {%>, '*.scss'<% } %>]);
});

gulp.task('elements', function () {
  return styleTask('elements', ['**/*.css'<% if (includeSass) {%>, '**/*.scss'<% } %>]);
});

// Lint JavaScript
gulp.task('jshint', function () {
  return gulp.src([
      'app/scripts/**/*.js',
      'app/elements/**/*.js',
      'app/elements/**/*.html'
    ])
    .pipe(reload({stream: true, once: true}))
    .pipe($.jshint.extract()) // Extract JS from .html files
    .pipe($.jshint())
    .pipe($.jshint.reporter('jshint-stylish'))
    .pipe($.if(!browserSync.active, $.jshint.reporter('fail')));
});

// Optimize Images
gulp.task('images', function () {
  return gulp.src('app/images/**/*')
    .pipe($.cache($.imagemin({
      progressive: true,
      interlaced: true
    })))
    .pipe(gulp.dest(DEPLOY_PATH + '/images'))
    .pipe($.size({title: 'images'}));
});

// Copy All Files At The Root Level (app)
gulp.task('copy', function () {
  var app = gulp.src([
    'app/*',
    '!app/test',
    'node_modules/apache-server-configs/dist/.htaccess'
  ], {
    dot: true
  }).pipe(gulp.dest(DEPLOY_PATH));

  var bower = gulp.src([
    'bower_components/**/*'
  ]).pipe(gulp.dest(DEPLOY_PATH + '/bower_components'));

  var elements = gulp.src(['app/elements/**/*.html'])
    .pipe(gulp.dest(DEPLOY_PATH + '/elements'));

  var vulcanized = gulp.src(['app/elements/elements.html'])
    .pipe($.rename('elements.vulcanized.html'))
    .pipe(gulp.dest(DEPLOY_PATH + '/elements'));

  return merge(app, bower, elements, vulcanized).pipe($.size({title: 'copy'}));
});

// Copy Web Fonts To Dist
gulp.task('fonts', function () {
  return gulp.src(['app/fonts/**'])
    .pipe(gulp.dest(DEPLOY_PATH + '/fonts'))
    .pipe($.size({title: 'fonts'}));
});

// Scan Your HTML For Assets & Optimize Them
gulp.task('html', function () {
  var assets = $.useref.assets({searchPath: ['.tmp', 'app', DEPLOY_PATH]});

  return gulp.src(['app/**/*.html', '!app/{elements,test}/**/*.html'])
    // Replace path for vulcanized assets
    .pipe($.if('*.html', $.replace('elements/elements.html', 'elements/elements.vulcanized.html')))
    .pipe(assets)
    // Concatenate And Minify JavaScript
    .pipe($.if('*.js', $.uglify({preserveComments: 'some'})))
    // Concatenate And Minify Styles
    // In case you are still using useref build blocks
    .pipe($.if('*.css', $.cssmin()))
    .pipe(assets.restore())
    .pipe($.useref())
    // Minify Any HTML
    .pipe($.if('*.html', $.minifyHtml({
      quotes: true,
      empty: true,
      spare: true
    })))
    // Output Files
    .pipe(gulp.dest(DEPLOY_PATH))
    .pipe($.size({title: 'html'}));
});

// Vulcanize imports
gulp.task('vulcanize', function () {
  var DEST_DIR = DEPLOY_PATH + '/elements';

  return gulp.src(DEPLOY_PATH + '/elements/elements.vulcanized.html')
    .pipe($.vulcanize({
      dest: DEST_DIR,
      strip: true,
      inline: true
    }))
    .pipe(gulp.dest(DEST_DIR))
    .pipe($.size({title: 'vulcanize'}));
});

// Clean Output Directory
gulp.task('clean', del.bind(null, ['.tmp', DEPLOY_PATH]));

// Watch Files For Changes & Reload
gulp.task('serve', ['styles', 'elements'], function () {
  browserSync({
    notify: false,
    // Run as an https by uncommenting 'https: true'
    // Note: this uses an unsigned certificate which on first access
    //       will present a certificate warning in the browser.
    // https: true,
    server: {
      baseDir: ['.tmp', 'app'],
      routes: {
        '/bower_components': 'bower_components'
      }
    }
  });

  gulp.watch(['app/**/*.html'], reload);<% if (includeSass) {%>
  gulp.watch(['app/styles/**/*.{scss,css}'], ['styles', reload]);
  gulp.watch(['app/elements/**/*.{scss,css}'], ['elements', reload]);<% } else { %>
  gulp.watch(['app/styles/**/*.css'], ['styles', reload]);
  gulp.watch(['app/elements/**/*.css'], ['elements', reload]);<% } %>
  gulp.watch(['app/{scripts,elements}/**/*.js'], ['jshint']);
  gulp.watch(['app/images/**/*'], reload);
});

// Build and serve the output from the dist build
gulp.task('serve:dist', ['default'], function () {
  browserSync({
    notify: false,
    // Run as an https by uncommenting 'https: true'
    // Note: this uses an unsigned certificate which on first access
    //       will present a certificate warning in the browser.
    // https: true,
    server: DEPLOY_PATH
  });
});

// Show cordova plugins listed in ./dist/plugins/fetch.json
gulp.task('plugins', function() {
  console.log('Plugins specified in plugins/fetch.json (install using "gulp plugins:install")\n');
  for (var i=0; i< Object.keys(plugins).length; i++) {
    console.log(Object.keys(plugins)[i]);
  }
  console.log('');
});

// Install cordova plugins listed in ./dist/plugins/fetch.json
gulp.task('plugins:install', shell.task(pluginInstructions, {
  cwd: CORDOVA_PATH
}));

// Install cordova plugin specified via --source param, e.g. '--source org.apache.cordova.dialogs'
gulp.task('plugins:add', shell.task('cordova plugin add '+ argv.source, {
  cwd: CORDOVA_PATH
}));


// Build and serve the output from the dist build to emulator
gulp.task('emulate', ['default'], shell.task([
  'cordova emulate ' + platform + deviceParam
], {
  cwd: CORDOVA_PATH
}));

// Build and serve the output from the dist build to emulator
gulp.task('run', ['default'], shell.task([
  'cordova run --device ' + platform + deviceParam
], {
  cwd: CORDOVA_PATH
}));

// Build and serve the output from the dist build to emulator
gulp.task('build:device', ['default'], shell.task([
  'cordova compile ' + platform + deviceParam + ' --device'
], {
  cwd: CORDOVA_PATH
}));

// Deploy to device
gulp.task('deploy:device', [], shell.task([
  // 'cordova run --nobuild ' + platform + deviceParam + ' --device' // --nobuild seems broken
  'cordova run --device ' + platform + deviceParam
], {
  cwd: CORDOVA_PATH
}));

// gulp.task('deploy:ios', ['default'], shell.task([
//   'ios-deploy --noninteractive --bundle ' + 'test' + '.app'
// ], {
//   cwd: './cordova/platforms/ios/build/device/'
// }));

// Build Production Files, the Default Task
gulp.task('default', ['clean'], function (cb) {
  runSequence(
    ['copy', 'styles'],
    'elements',
    ['jshint', 'images', 'fonts', 'html'],
    'vulcanize',
    cb);
});

// Run PageSpeed Insights
// Update `url` below to the public URL for your site
gulp.task('pagespeed', function (cb) {
  // Update the below URL to the public URL of your site
  pagespeed.output('example.com', {
    strategy: 'mobile',
    // By default we use the PageSpeed Insights free (no API key) tier.
    // Use a Google Developer API key if you have one: http://goo.gl/RkN0vE
    // key: 'YOUR_API_KEY'
  }, cb);
});

<% if (includeWCT) { %>
// Load tasks for web-component-tester
// Adds tasks for `gulp test:local` and `gulp test:remote`
try { require('web-component-tester').gulp.init(gulp); } catch (err) {}<% } %>

// Load custom tasks from the `tasks` directory
try { require('require-dir')('tasks'); } catch (err) {}
