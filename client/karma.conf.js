// Karma configuration for the Angular unit tests.
//
// Angular's test builder ships a sensible default Karma config, but it has no
// coverage *gate*. We provide our own so we can add `coverageReporter.check`
// thresholds - that turns the coverage number from a vanity metric into a
// build gate that fails CI on a regression.
//
// The thresholds below are a FLOOR set just under the current numbers, not an
// aspiration: their job is "coverage must not drop." Raise them as more
// component specs land. (The component/UI layer is primarily covered by the
// Cypress e2e + API suites rather than Karma unit tests, which is why the
// global unit-coverage floor is intentionally modest.)
module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('@angular-devkit/build-angular/plugins/karma')
    ],
    client: {
      jasmine: {},
      clearContext: false // leave the Jasmine spec runner output visible in the browser
    },
    jasmineHtmlReporter: {
      suppressAll: true // remove duplicated traces
    },
    coverageReporter: {
      dir: require('path').join(__dirname, './coverage/banking-admin-portal'),
      subdir: '.',
      reporters: [{ type: 'html' }, { type: 'text-summary' }],
      check: {
        global: {
          statements: 50,
          branches: 35,
          functions: 38,
          lines: 50
        }
      }
    },
    reporters: ['progress', 'kjhtml'],
    browsers: ['Chrome'],
    restartOnFileChange: true
  });
};
