/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

const HtmlWebpackPlugin = require("html-webpack-plugin");
const InlineChunkHtmlPlugin = require("react-dev-utils/InlineChunkHtmlPlugin");
const path = require("path");
const { EnvironmentPlugin } = require("webpack");

module.exports = {
  entry: path.resolve(__dirname, "frame_entry_point.ts"),
  mode: "production",
  module: { rules: [{ test: /\.ts$/, loader: "ts-loader" }] },
  resolve: { extensions: [".ts"] },
  plugins: [
    new EnvironmentPlugin(["ALLOWED_LOGIC_URL_PREFIXES"]),
    new HtmlWebpackPlugin({
      filename: "frame.html",
      template: path.resolve(__dirname, "frame.html"),
      scriptLoading: "blocking",
    }),
    new InlineChunkHtmlPlugin(HtmlWebpackPlugin, /* tests= */ [/.*/]),
  ],
};
