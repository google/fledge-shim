/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

const webpack = require("webpack");
const webpackDevMiddleware = require("webpack-dev-middleware");

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
    files: ["frame/**/*.ts", "lib/**/*.ts"],
    middleware: ["webpack-dev"],
    preprocessors: { "**/*.ts": "karma-typescript" },
    reporters: ["progress", "karma-typescript"],
    browsers: ["ChromeHeadless"],
    karmaTypescriptConfig: {
      compilerOptions: { module: "commonjs" },
      tsconfig: "./tsconfig.json",
    },
  });
};
