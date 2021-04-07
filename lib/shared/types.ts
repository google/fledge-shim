/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/** @fileoverview TODO */

/** TODO */
export function isObject(
  value: unknown
): value is { readonly [key: string]: unknown } {
  return value != null;
}

/** TODO */
export function isArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}
