'use strict';
var yeoman = require('yeoman-generator');
var path = require('path');
var yosay = require('yosay');
var chalk = require('chalk');
var cordova = require('cordova-lib').cordova.raw; // get the promise version of all methods

module.exports = yeoman.generators.Base.extend({
  constructor: function () {
    yeoman.generators.Base.apply(this, arguments);

    this.option('skip-install', {
      desc:     'Whether dependencies should be installed',
      defaults: false,
    });

    this.option('skip-install-message', {
      desc:     'Whether commands run should be shown',
      defaults: false,
    });
  },
  askFor: function () {
    var done = this.async();

    // Have Yeoman greet the user.
    this.log(yosay('Out of the box I include HTML5 Boilerplate, Polymer and Cordova'));

    var prompts = [{
      //   name: 'includeGulp',
      //   message: 'Would you prefer Gulp or Grunt?',
      //   type: 'list',
      //   choices: ['Gulp', 'Grunt']
      // }, {
        name: 'includeCore',
        message: 'Would you like to include core-elements?',
        type: 'confirm'
      }, {
        name: 'includePaper',
        message: 'Would you like to include paper-elements?',
        type: 'confirm'
      }, {
        name: 'includeSass',
        message: 'Would you like to use SASS/SCSS for element styles?',
        type: 'confirm'
      }, {
        name: 'includeWCT',
        message: 'Would you like to include web-component-tester?',
        type: 'confirm'

      // }, {
      //   name: 'author',
      //   message: 'What is the Cordova project\'s author name?',
      //   default: 'please_change'
      // }, {
      //   name: 'email',
      //   message: 'What is the Cordova project\'s author email address?',
      //   default: ''
      // }, {
      //   name: 'url',
      //   message: 'What is the Cordova project\'s author URL?',
      //   default: ''
      }, {
        name: 'appName',
        message: 'What is the Cordova project\'s app name?',
        default: 'please_change'
      }, {
        name: 'appId',
        message: 'What is the Cordova project\'s app ID? (E.g. com.foobar.appname)',
        default: 'please_change'
      // }, {
      //   name: 'appVersion',
      //   message: 'What is the Cordova project\'s app version?',
      //   default: '0.0.0'
      // }, {
      //   name: 'appDescription',
      //   message: 'You can now enter a description for the app',
      //   default: ''
      }, {
        name: 'platforms',
        message: 'Select all platforms you want to support:',
        choices: [
          {
            value: 'ios',
            name: 'iOS',
            checked: true
          },
          {
            value: 'android',
            name: 'Android',
            checked: true
          }
        ],
        type: 'checkbox'
      // }, {
      //   name: 'includeCordovaApp',
      //   message: 'Would you like a scaffolded sample app including Cordova plugins?',
      //   type: 'confirm'
      }, {
        name: 'plugins',
        message: 'Select all cordova plugins you want to install (use default selection for sample app)',
        choices: [
          {
            value: 'org.apache.cordova.device',
            name: 'Device - org.apache.cordova.device',
            checked: true
          },
          {
            value: 'org.apache.cordova.dialogs',
            name: 'Dialogs - org.apache.cordova.dialogs',
            checked: true
          },
          {
            value: 'org.apache.cordova.geolocation',
            name: 'Geolocation - org.apache.cordova.geolocation'
          },
          {
            value: 'org.apache.cordova.globalization',
            name: 'Geolocation - org.apache.cordova.globalization',
            checked: true
          },
          {
            value: 'org.apache.cordova.inappbrowser',
            name: 'In App Browser - org.apache.cordova.inappbrowser'
          },
          {
            value: 'org.apache.cordova.network-information',
            name: 'Network - org.apache.cordova.network-information',
            checked: true
          },
          {
            value: 'org.apache.cordova.splashscreen',
            name: 'Splashscreen - org.apache.cordova.splashscreen',
            checked: true
          },
          {
            value: 'org.apache.cordova.statusbar',
            name: 'Statusbar - org.apache.cordova.statusbar'
          }
        ],
        type: 'checkbox'
      // }, { // prompt whether to use default app or modularized core-scaffold based app
      //   name: 'useDefaultApp',
      //   message: 'Use default Polymer app?'
      //   type: 'confirm'
      }];

    this.prompt(prompts, function (answers) {
      // only support Gulp for now
      // this.includeGulp = answers.includeGulp === 'Gulp';
      this.includeGulp = true;
      this.includeCore = answers.includeCore;
      this.includePaper = answers.includePaper;
      this.includeSass = answers.includeSass;
      // LibSASS disabled until this is fixed
      // https://github.com/sass/libsass/issues/452
      this.includeLibSass = false;
      this.includeRubySass = answers.includeSass;
      this.includeWCT = answers.includeWCT;

      this.answers = answers; // used for Cordova config.xml

      // Save user configuration options to .yo-rc.json file
      this.config.set({
        includeSass: this.includeSass
      });
      this.config.save();

      done();
    }.bind(this));
  },

  cordova: function () {
    if (this.update) {
      return true;
    }

    var done = this.async(); // wait with subsequent tasks since cordova needs an empty folder
    var CORDOVA_ROOT = 'dist';
    var PROJECT_ROOT = process.cwd(); // polymer project root
    this.mkdir(CORDOVA_ROOT);
    process.chdir(CORDOVA_ROOT);

    var done = this.async(); // wait with subsequent tasks since cordova needs an empty folder
    // cordova project
    cordova.create('.', this.answers.appId, this.answers.appName)
    // add platforms
    .then(function () {
      this.log(chalk.green('Created cordova project'));
      if (this.options['skip-sdk'] || !this.answers.platforms.length) {
        return true;
      }
      else {
        return cordova.platform('add', this.answers.platforms);
      }
    }.bind(this))
    // add plugins
    .then(function () {
      this.log(chalk.green('Added platforms: ' + this.answers.platforms.join(', ')));
      if (this.options['skip-sdk'] || !this.answers.plugins.length) {
        return true;
      }
      else {
        return cordova.plugins('add', this.answers.plugins);
      }
    }.bind(this))
    // all
    .then(function () {
      this.log(chalk.green('Added plugins: ' + this.answers.plugins.join(', ')));
      this.log(chalk.green('Cordova project was set up successfully! Project Name: '), chalk.bgGreen(this.answers.appName));
      process.chdir(PROJECT_ROOT);
      done();
    }.bind(this))
    .catch(function (err) {
      console.log(err);
      this.log(chalk.red('Couldn\'t finish generator: \n' + err));
      // process.exit(1);
    }.bind(this));
  },

  app: function () {
    this.copy('gitignore', '.gitignore');
    this.copy('gitattributes', '.gitattributes');
    this.copy('bowerrc', '.bowerrc');
    this.copy('bower.json', 'bower.json');
    this.copy('wct.conf.js', 'wct.conf.js');
    this.copy('jshintrc', '.jshintrc');
    this.copy('editorconfig', '.editorconfig');
    if (this.includeGulp) {
      this.template('gulpfile.js');
    } else {
      this.template('Gruntfile.js');
    }
    this.template('_package.json', 'package.json');
    this.mkdir('app');
    this.mkdir('app/styles');
    this.mkdir('app/images');
    this.mkdir('app/scripts');
    this.mkdir('app/elements');
    this.template('app/404.html');
    this.template('app/favicon.ico');
    this.template('app/robots.txt');
    this.copy('app/main.css',
      this.includeSass ? 'app/styles/main.scss':
                         'app/styles/main.css');
    this.copy('app/app.js', 'app/scripts/app.js');
    this.copy('app/htaccess', 'app/.htaccess');
    this.copy('app/elements.html', 'app/elements/elements.html');
    this.copy('app/yo-list.html', 'app/elements/yo-list/yo-list.html');
    this.copy('app/yo-list.css',
      this.includeSass ? 'app/elements/yo-list/yo-list.scss':
                         'app/elements/yo-list/yo-list.css');
    this.copy('app/yo-greeting.html', 'app/elements/yo-greeting/yo-greeting.html');
    this.copy('app/yo-greeting.css',
      this.includeSass ? 'app/elements/yo-greeting/yo-greeting.scss':
                         'app/elements/yo-greeting/yo-greeting.css');
    this.copy('app/index.html', 'app/index.html');
    if (this.includeWCT) {
      this.directory('test', 'app/test');
    }
    if (this.answers.includeCordovaApp) {
      // this.copy('app/dist/plugins/fetch.json', 'app/dist/plugins/fetch.json');
      // this.template('app/dist/config.xml', 'app/dist/config.xml', this.answers);
    }
  },
  install: function () {
    this.installDependencies({
      skipInstall: this.options['skip-install'],
      skipMessage: this.options['skip-install-message'],
    });
  }
});
