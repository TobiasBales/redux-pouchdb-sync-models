const path = require('path');

module.exports = function(wallaby) {
  process.env.NODE_PATH +=
    path.delimiter + path.join(__dirname, 'node_modules');
  require('module').Module._initPaths();

  process.env.NODE_ENV = 'development';

  return {
    files: [
      'src/**/*.ts*',
      { pattern: 'src/**/*.test.ts*', ignore: true },
      { pattern: 'src/**/*.spec.ts*', ignore: true },
    ],
    tests: ['src/**/*.test.ts*', 'src/**/*.spec.ts*'],
    env: { type: 'node', runner: 'node' },
    setup: wallaby => {
      wallaby.testFramework.configure({
        moduleNameMapper: {
          '^.*\\.(ts|tsx)$': require.resolve('ts-jest/preprocessor.js'),
        },
      });
    },
    testFramework: 'jest',
  };
};
