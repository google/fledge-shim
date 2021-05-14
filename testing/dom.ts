/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Utility functions used only in test code, that facilitate
 * testing of DOM operations.
 */

import "jasmine";

/**
 * Causes all tests in the current `describe` to use a clean DOM for each test.
 * Specifically, the state of the `<html>` element is snapshotted by deep
 * cloning before each test, and then used to overwrite
 * `document.documentElement` afterward. This means that test cases can mutate
 * the DOM body, attach things to it, etc., without these state changes leaking
 * into other test cases.
 *
 * This must be called directly within the callback body of a `describe`, before
 * any `it` calls.
 */
export function cleanDomAfterEach(): void {
  let documentElement: Node;
  beforeEach(() => {
    documentElement = document.documentElement.cloneNode(/* deep= */ true);
  });
  afterEach(() => {
    document.replaceChild(documentElement, document.documentElement);
  });
}
