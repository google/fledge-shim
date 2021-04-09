/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/** @fileoverview TODO */

/** TODO */
export function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.stack || error.toString()
    : JSON.stringify(error) ?? "undefined";
}
