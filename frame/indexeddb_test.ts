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
    await useStore("readwrite", (store) => {
      store.put(value, key);
    });
    await useStore("readonly", (store) => {
      const retrievalRequest = store.get(key);
      retrievalRequest.onsuccess = () => {
        expect(retrievalRequest.result).toBe(value);
      };
    });
  });

  it("should reject if the transaction is aborted", () =>
    expectAsync(
      useStore("readonly", (store) => {
        store.transaction.abort();
      })
    ).toBeRejectedWith(null));

  it("should not commit the transaction if the main callback throws", async () => {
    const errorMessage = "oops";
    await expectAsync(
      useStore("readwrite", (store) => {
        store.add(value, key);
        throw new Error(errorMessage);
      })
    ).toBeRejectedWithError(errorMessage);
    await useStore("readonly", (store) => {
      const countRequest = store.count();
      countRequest.onsuccess = () => {
        expect(countRequest.result).toBe(0);
      };
    });
  });

  const otherValue = "other IndexedDB value";
  const otherKey = "other IndexedDB key";

  it("should not commit the transaction if an illegal operation is attempted", async () => {
    await useStore("readwrite", (store) => {
      store.put(value, key);
    });
    await expectAsync(
      useStore("readwrite", (store) => {
        store.add(otherValue, otherKey);
        // add requires that the given key not already exist.
        store.add(otherValue, key);
      })
    ).toBeRejectedWith(
      jasmine.objectContaining({
        constructor: DOMException,
        name: "ConstraintError",
      })
    );
    await useStore("readonly", (store) => {
      const retrievalRequest = store.get(otherKey);
      retrievalRequest.onsuccess = () => {
        expect(retrievalRequest.result).toBeUndefined();
      };
    });
  });

  it("should commit the transaction if an error is recovered from", async () => {
    await useStore("readwrite", (store) => {
      store.put(value, key);
    });
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
    });
    await useStore("readonly", (store) => {
      const retrievalRequest = store.get(otherKey);
      retrievalRequest.onsuccess = () => {
        expect(retrievalRequest.result).toBe(otherValue);
      };
    });
  });
});
