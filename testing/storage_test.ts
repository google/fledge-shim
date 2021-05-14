/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import "jasmine";
import * as idbKeyval from "idb-keyval";
import { clearStorageBeforeAndAfter } from "./storage";

describe("clearStorageBeforeAndAfter", () => {
  describe("with sessionStorage", () => {
    clearStorageBeforeAndAfter();
    for (const nth of ["first", "second"]) {
      it(`should not already contain item when adding it (${nth} time)`, () => {
        expect(sessionStorage.length).toBe(0);
        const key = "sessionStorage key";
        const value = "sessionStorage value";
        sessionStorage.setItem(key, value);
        expect(sessionStorage.getItem(key)).toBe(value);
      });
    }
  });

  describe("with idb-keyval", () => {
    clearStorageBeforeAndAfter();
    for (const nth of ["first", "second"]) {
      it(`should not already contain item when adding it (${nth} time)`, async () => {
        expect(await idbKeyval.entries()).toEqual([]);
        const key = "idb-keyval key";
        const value = "idb-keyval value";
        await idbKeyval.set(key, value);
        const retrieved: unknown = await idbKeyval.get(key);
        expect(retrieved).toBe(value);
      });
    }
  });

  describe("with beforeEach", () => {
    clearStorageBeforeAndAfter();
    const key = "sessionStorage key from beforeEach test";
    const value = "sessionStorage value from beforeEach test";
    beforeEach(() => {
      sessionStorage.setItem(key, value);
    });
    it("should have stored an item in beforeEach", () => {
      expect(sessionStorage.getItem(key)).toBe(value);
    });
  });

  describe("with afterEach", () => {
    clearStorageBeforeAndAfter();
    const key = "sessionStorage key from afterEach test";
    const value = "sessionStorage value from afterEach test";
    afterEach(() => {
      expect(sessionStorage.getItem(key)).toBe(value);
    });
    it("stores an item", () => {
      sessionStorage.setItem(key, value);
      expect().nothing();
    });
  });
});
