/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

module.exports = {
  env: { browser: true, es2020: true },
  extends: [
    "eslint:recommended",
    "plugin:jsdoc/recommended",
    "google",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "prettier",
  ],
  ignorePatterns: [
    "dist/",
    // This configuration is designed for TypeScript and much of it doesn't
    // work properly with .js files.
    ".eslintrc.js",
    "fake_server.js",
    "karma.conf.js",
    "webpack.config.js",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    sourceType: "module",
    tsconfigRootDir: __dirname,
    project: ["./tsconfig.json"],
  },
  plugins: ["@typescript-eslint", "jsdoc"],
  rules: {
    "max-len": [
      "warn",
      {
        // Whatever Prettier wraps lines to is acceptable.
        code: Infinity,
        // However, Prettier doesn't wrap comments.
        comments: 80,
        ignorePattern: String.raw`^\s*// eslint-disable-next-line.*`,
        ignoreUrls: true,
      },
    ],
    // Per https://eslint.org/docs/rules/no-inner-declarations, this is obsolete
    // since ES2015.
    "no-inner-declarations": "off",
    // Superseded by jsdoc/require-jsdoc.
    "require-jsdoc": "off",
    // Many JSDoc-related rules are superseded by TypeScript type annotation
    // syntax.
    "valid-jsdoc": "off",
    "jsdoc/check-indentation": "warn",
    "jsdoc/check-param-names": "off",
    "jsdoc/check-values": [
      "error",
      {
        allowedLicenses: true,
        licensePattern:
          "^\nCopyright 2021 Google LLC\nSPDX-License-Identifier: Apache-2\\.0$",
      },
    ],
    // Non-test files require both @license and a @fileoverview.
    "jsdoc/require-file-overview": [
      "error",
      {
        tags: {
          file: {
            mustExist: true,
            preventDuplicates: true,
            initialCommentsOnly: true,
          },
          license: {
            mustExist: true,
            preventDuplicates: true,
            initialCommentsOnly: true,
          },
        },
      },
    ],
    "jsdoc/require-jsdoc": ["warn", { publicOnly: true }],
    "jsdoc/require-param": "off",
    "jsdoc/require-param-type": "off",
    "jsdoc/require-returns": "off",
    "jsdoc/require-returns-type": "off",
  },
  overrides: [
    {
      files: ["*_test.ts"],
      rules: {
        // Same issue as with Jest
        // (https://github.com/typescript-eslint/typescript-eslint/blob/master/packages/eslint-plugin/docs/rules/unbound-method.md),
        // but there's currently no Jasmine equivalent of
        // eslint-plugin-jest/unbound-method, so we have to just disable the
        // rule entirely.
        "@typescript-eslint/unbound-method": "off",
        // Test files require @license, but not @fileoverview.
        "jsdoc/require-file-overview": [
          "error",
          {
            tags: {
              license: {
                mustExist: true,
                preventDuplicates: true,
                initialCommentsOnly: true,
              },
            },
          },
        ],
      },
    },
  ],
  settings: {
    jsdoc: {
      // Google Style uses these tag names.
      tagNamePreference: { file: "fileoverview", returns: "return" },
    },
  },
};
