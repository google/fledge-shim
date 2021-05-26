/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Utility functions used only in test code, that facilitate
 * the use of TypeScript type narrowing in Jasmine tests.
 *
 * These are like Jasmine `expect`, but throw if the expectations are not met,
 * instead of recording a failure. This allows them to serve as TypeScript type
 * guards.
 */

import "jasmine";
import { isObject } from "../lib/shared/guards";

/** Asserts that the given value is truthy. Throws otherwise. */
export function assertToBeTruthy(actual: unknown): asserts actual {
  if (!actual) {
    throw new TypeError(`Expected ${String(actual)} to be truthy`);
  }
}

/** Asserts that the given value is a string. Throws otherwise. */
export function assertToBeString(actual: unknown): asserts actual is string {
  if (typeof actual !== "string") {
    throw new TypeError(`Expected ${typeDescription(actual)} to be a string`);
  }
}

/**
 * Asserts that the given value is an instance of the given constructor's class.
 * Throws otherwise.
 */
export function assertToBeInstanceOf<T>(
  actual: unknown,
  ctor: abstract new (...args: never[]) => T
): asserts actual is T {
  if (!(actual instanceof ctor)) {
    throw new TypeError(
      `Expected ${typeDescription(actual)} to be an instance of ${ctor.name}`
    );
  }
}

/**
 * Asserts that the given type guard function is true of the given value. Throws
 * otherwise.
 */
export function assertToSatisfyTypeGuard<T>(
  actual: unknown,
  guard: (value: unknown) => value is T
): asserts actual is T {
  if (!guard(actual)) {
    throw new TypeError(
      `Expected ${typeDescription(actual)} to satisfy ${guard.name}`
    );
  }
}

function typeDescription(value: unknown) {
  return isObject(value)
    ? `instance of ${value.constructor.name}`
    : String(value);
}
