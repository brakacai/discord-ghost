/* eslint-disable @typescript-eslint/no-var-requires */
const typescriptConfig = require("@istanbuljs/nyc-config-typescript");

module.exports = {
  ...typescriptConfig,
  exclude: typescriptConfig.exclude.concat([".mocharc.js", "**/*.config.js", "**/webpack.*.js", "tools/**/*"]),
  includes: ["src/**/*.ts"],
  reporter: ["lcov", "text"],
  all: true
};
