/* eslint-disable @typescript-eslint/no-var-requires */
const typescriptConfig = require("@istanbuljs/nyc-config-typescript");

module.exports = {
  ...typescriptConfig,
  exclude: typescriptConfig.exclude.concat([
    ".mocharc.js",
    "**/{ava,babel,jest,nyc,rollup,webpack,prettier,release}.config.js",
    "tools/**/*"
  ]),
  includes: ["src/**/*.ts"],
  reporter: ["lcov", "text"],
  all: true
};
