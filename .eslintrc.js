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
    ".eslintrc.js",
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
        comments: 80,
        ignoreUrls: true,
        ignoreStrings: true,
        ignoreTemplateLiterals: true,
      },
    ],
    "no-inner-declarations": "off",
    "require-jsdoc": "off",
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
        "@typescript-eslint/no-non-null-assertion": "off",
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
      tagNamePreference: { file: "fileoverview", returns: "return" },
    },
  },
};
