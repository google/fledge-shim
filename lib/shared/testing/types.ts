/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Utility functions used only in test code, that allow tests to
 * take advantage of TypeScript's flow-control-based type checking.
 */

/** Throws if the given condition is false. */
export function assert(condition: boolean): asserts condition {
  if (!condition) {
    throw new TypeError("Assertion failure");
  }
}

/** Throws if the given value is null or undefined; returns it otherwise. */
export function nonNullish<T>(value: T | null | undefined): T {
  assert(value != null);
  return value;
}
