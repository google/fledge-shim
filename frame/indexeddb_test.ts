/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { assertToBeInstanceOf } from "../testing/assert";
import { clearStorageBeforeAndAfter } from "../testing/storage";
import { useStore } from "./indexeddb";

describe("useStore", () => {
  clearStorageBeforeAndAfter();

  const value = "IndexedDB value";
  const key = "IndexedDB key";

  it("should read its own writes across multiple transactions", async () => {
    expect(
      await useStore("readwrite", (store) => {
        store.put(value, key);
      })
    ).toBeTrue();
    expect(
      await useStore("readonly", (store) => {
        const retrievalRequest = store.get(key);
        retrievalRequest.onsuccess = () => {
          expect(retrievalRequest.result).toBe(value);
        };
      })
    ).toBeTrue();
  });

  it("should return false and not log if the transaction is manually aborted", async () => {
    const consoleSpy = spyOnAllFunctions(console);
    expect(
      await useStore("readonly", (store) => {
        store.transaction.abort();
      })
    ).toBeFalse();
    expect(consoleSpy.error).not.toHaveBeenCalled();
  });

  it("should return false and log an error if opening the object store fails", async () => {
    const consoleSpy = spyOnAllFunctions(console);
    expect(
      await useStore("readonly", fail, "bogus-nonexistent-store-name")
    ).toBeFalse();
    expect(consoleSpy.error).toHaveBeenCalledOnceWith(jasmine.any(String));
  });

  it("should and not commit the transaction if the main callback throws", async () => {
    const consoleSpy = spyOnAllFunctions(console);
    const errorMessage = "oops";
    await expectAsync(
      useStore("readwrite", (store) => {
        store.add(value, key);
        throw new Error(errorMessage);
      })
    ).toBeRejectedWithError(errorMessage);
    expect(
      await useStore("readonly", (store) => {
        const countRequest = store.count();
        countRequest.onsuccess = () => {
          expect(countRequest.result).toBe(0);
        };
      })
    ).toBeTrue();
    expect(consoleSpy.error).not.toHaveBeenCalled();
  });

  const otherValue = "other IndexedDB value";
  const otherKey = "other IndexedDB key";

  it("should not commit the transaction if an illegal operation is attempted", async () => {
    const consoleSpy = spyOnAllFunctions(console);
    expect(
      await useStore("readwrite", (store) => {
        store.put(value, key);
      })
    ).toBeTrue();
    expect(
      await useStore("readwrite", (store) => {
        store.add(otherValue, otherKey);
        // add requires that the given key not already exist.
        store.add(otherValue, key);
      })
    ).toBeFalse();
    expect(consoleSpy.error).toHaveBeenCalledOnceWith(jasmine.any(String));
    expect(
      await useStore("readonly", (store) => {
        const retrievalRequest = store.get(otherKey);
        retrievalRequest.onsuccess = () => {
          expect(retrievalRequest.result).toBeUndefined();
        };
      })
    ).toBeTrue();
  });

  it("should commit the transaction if an error is recovered from", async () => {
    const consoleSpy = spyOnAllFunctions(console);
    expect(
      await useStore("readwrite", (store) => {
        store.put(value, key);
      })
    ).toBeTrue();
    expect(
      await useStore("readwrite", (store) => {
        store.add(otherValue, otherKey);
        // add requires that the given key not already exist.
        const badRequest = store.add(otherValue, key);
        badRequest.onsuccess = fail;
        badRequest.onerror = (event) => {
          assertToBeInstanceOf(badRequest.error, DOMException);
          expect(badRequest.error.name).toBe("ConstraintError");
          event.preventDefault();
        };
      })
    ).toBeTrue();
    expect(
      await useStore("readonly", (store) => {
        const retrievalRequest = store.get(otherKey);
        retrievalRequest.onsuccess = () => {
          expect(retrievalRequest.result).toBe(otherValue);
        };
      })
    ).toBeTrue();
    expect(consoleSpy.error).not.toHaveBeenCalled();
  });
});
