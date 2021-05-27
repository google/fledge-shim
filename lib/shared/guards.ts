/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Utility functions for working around deficiencies in
 * TypeScript's flow-control-based type checking.
 */

/**
 * Returns whether it's safe to access properties on this object (i.e., whether
 * doing so will throw). This should be used instead of an inline `!= null`
 * comparison in order to safely access arbitrary properties of an object with
 * unknown structure. If an inline comparison is used, TypeScript won't allow
 * this.
 */
export function isObject(
  value: unknown
): value is { readonly [key: string]: unknown } {
  return value != null;
}

/**
 * Returns whether the given value is a plain-old-data object (i.e., not an
 * array or function or instance of some other type). This is intended for
 * runtime type checking of values parsed from JSON.
 */
export function isKeyValueObject(
  value: unknown
): value is { readonly [key: string]: unknown } {
  return isObject(value) && Object.getPrototypeOf(value) === Object.prototype;
}

/**
 * Like `Array.isArray`, but returns `unknown[]` instead of `any[]`, avoiding
 * warnings.
 */
export function isArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}
