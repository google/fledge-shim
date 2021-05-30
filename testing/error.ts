/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Utility functions used only in test code, that facilitate
 * testing what happens when an event handler throws.
 *
 * By default, Jasmine handles the global error event and fails the test, so we
 * we need to intercept it ourselves to avoid this.
 */

/**
 * Causes Jasmine's default global error handler (which fails the current test)
 * to be restored after each test in the current `describe`. This allows those
 * tests to safely overwrite `onerror`, and thereby test behavior that occurs in
 * case of an unhandled error.
 *
 * This must be called directly within the callback body of a `describe`, before
 * any `it` calls.
 */
export function restoreErrorHandlerAfterEach(): void {
  let errorHandler: typeof onerror;
  beforeEach(() => {
    errorHandler = onerror;
  });
  afterEach(() => {
    onerror = errorHandler;
  });
}
