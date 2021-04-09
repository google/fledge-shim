/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

module.exports = (config) => {
  config.set({
    frameworks: ["jasmine", "karma-typescript"],
    files: ["frame/**/*.ts", "lib/**/*.ts"],
    preprocessors: { "**/*.ts": "karma-typescript" },
    reporters: ["progress", "karma-typescript"],
    browsers: ["ChromeHeadless"],
    karmaTypescriptConfig: {
      compilerOptions: { module: "commonjs" },
      tsconfig: "./tsconfig.json",
    },
  });
};
