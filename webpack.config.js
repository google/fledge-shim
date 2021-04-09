/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

const HtmlWebpackPlugin = require("html-webpack-plugin");
const InlineChunkHtmlPlugin = require("react-dev-utils/InlineChunkHtmlPlugin");
const TerserPlugin = require("terser-webpack-plugin");
const path = require("path");

module.exports = {
  entry: path.resolve(__dirname, "frame_entry_point.ts"),
  mode: "production",
  module: { rules: [{ test: /\.ts$/, loader: "ts-loader" }] },
  resolve: { extensions: [".ts"] },
  optimization: {
    minimizer: [
      new TerserPlugin({
        terserOptions: { format: { comments: /@license/ } },
        extractComments: false,
      }),
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      filename: "frame.html",
      template: path.resolve(__dirname, "frame.html"),
      scriptLoading: "blocking",
    }),
    new InlineChunkHtmlPlugin(HtmlWebpackPlugin, /* tests= */ [/.*/]),
  ],
};
