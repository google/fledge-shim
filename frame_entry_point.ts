/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview The entry point of execution for the JavaScript code inlined
 * in the frame.
 */

import { main } from "./frame/main";

const allowedLogicUrlPrefixesJoined = process.env.ALLOWED_LOGIC_URL_PREFIXES;
// It shouldn't be possible for this to be undefined; Webpack will fail the
// build if no value is provided.
if (allowedLogicUrlPrefixesJoined === undefined) {
  throw new Error();
}
main(window, allowedLogicUrlPrefixesJoined);
