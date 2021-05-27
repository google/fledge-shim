/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Utility functions used only in test code, that facilitate
 * testing of code that interacts with client-side storage.
 */

import "jasmine";
import { useStore } from "../frame/indexeddb";

/**
 * Completely empties everything out of IndexedDB and `sessionStorage` before
 * each test in the current suite, and again after the suite to prevent leakage.
 */
export function clearStorageBeforeAndAfter(): void {
  beforeEach(clearStorage);
  afterAll(clearStorage);
}

async function clearStorage() {
  sessionStorage.clear();
  expect(
    await useStore("readwrite", (store) => {
      store.clear();
    })
  ).toBeTrue();
}
