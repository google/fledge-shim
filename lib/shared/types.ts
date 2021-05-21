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

/**
 * Returns an error appropriate for when an assertion fails.
 *
 * Due to the generic error message, this should be used only in test code or
 * when it is believed (but not proven) impossible for the check to fail.
 */
export function assertionError(): TypeError {
  return new TypeError("Assertion failure");
}

/**
 * Throws if the given condition is false.
 *
 * Due to the generic error message, this should be used only in test code or
 * when it is believed (but not proven) impossible for the check to fail.
 */
export function assert(condition: boolean): asserts condition {
  if (!condition) {
    throw assertionError();
  }
}

/**
 * Throws if the given type guard function is not true for the given value.
 *
 * Due to the generic error message, this should be used only in test code or
 * when it is believed (but not proven) impossible for the check to fail.
 */
export function assertType<T>(
  value: unknown,
  guard: (value: unknown) => value is T
): asserts value is T {
  if (!guard(value)) {
    throw new TypeError(`Assertion failure: ${JSON.stringify(value)}`);
  }
}

/**
 * Throws if the given value is not an instance of the given class.
 *
 * Due to the generic error message, this should be used only in test code or
 * when it is believed (but not proven) impossible for the check to fail.
 */
export function assertInstance<T>(
  value: unknown,
  ctor: new (...args: never) => T
): asserts value is T {
  assertType(value, (val): val is T => val instanceof ctor);
}

/**
 * Throws if the given value is null or undefined; returns it otherwise.
 *
 * Due to the generic error message, this should be used only in test code or
 * when it is believed (but not proven) impossible for the check to fail.
 */
export function nonNullish<T>(value: T | null | undefined): T {
  assert(value != null);
  return value;
}
