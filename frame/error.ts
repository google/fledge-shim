/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Utilities for serializing arbitrary thrown or rejected values
 * as strings so that they can be reported back to the library.
 */

/**
 * Returns the most informative error message that can be extracted from the
 * given value.
 */
export function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.stack || error.toString()
    : JSON.stringify(error) ?? "undefined";
}
