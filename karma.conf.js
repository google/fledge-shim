/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

const webpack = require("webpack");
const webpackDevMiddleware = require("webpack-dev-middleware");

// This specifically affects the frame served by webpack-dev-middleware,
// which lib/public_api_test.ts depends on.
process.env.ALLOWED_LOGIC_URL_PREFIXES =
  "https://dsp.test/,https://dsp-1.test/,https://dsp-2.test/,https://ssp.test/";

module.exports = (config) => {
  config.set({
    plugins: [
      "karma-*",
      {
        // Serves the compiled frame at /frame.html.
        "middleware:webpack-dev": [
          "factory",
          // https://github.com/karma-runner/karma/issues/2781
          function () {
            return webpackDevMiddleware(
              webpack(require("./webpack.config.js"))
            );
          },
        ],
      },
    ],
    frameworks: ["jasmine", "karma-typescript"],
    files: [
      "frame/**/*.ts",
      "lib/**/*.ts",
      "testing/**/*.ts",
      { pattern: "fake_server.js", included: false },
    ],
    middleware: ["webpack-dev"],
    preprocessors: { "**/*.ts": "karma-typescript" },
    proxies: { "/fake_server.js": "/base/fake_server.js" },
    reporters: ["progress", "karma-typescript"],
    browsers: ["ChromeHeadless"],
    karmaTypescriptConfig: {
      compilerOptions: { module: "commonjs" },
      tsconfig: "./tsconfig.json",
    },
  });
};
