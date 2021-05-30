/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Utilities for performing IndexedDB operations, in order to
 * persistently store and retrieve data client-side.
 */

import { logError } from "./console";

const DB_NAME = "fledge-shim";
const STORE_NAME = "interest-groups";

const dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
  const dbRequest = indexedDB.open(DB_NAME, /* version= */ 1);
  dbRequest.onupgradeneeded = ({ oldVersion, newVersion }) => {
    // This should be called iff the database is just now being created for the
    // first time. It shouldn't be possible for the version numbers to differ
    // from the expected ones.
    /* istanbul ignore if */
    if (oldVersion !== 0 || newVersion !== 1) {
      throw new Error(`${oldVersion},${String(newVersion)}`);
    }
    dbRequest.result.createObjectStore(STORE_NAME);
  };
  dbRequest.onsuccess = () => {
    resolve(dbRequest.result);
  };
  dbRequest.onerror = () => {
    reject(dbRequest.error);
  };
  // Since the version number is 1 (the lowest allowed), it shouldn't be
  // possible for an earlier version of the same database to already be open.
  dbRequest.onblocked = /* istanbul ignore next */ () => {
    reject(new Error());
  };
});

/**
 * Runs an arbitrary operation on the IndexedDB object store and returns whether
 * it was committed successfully. `callback` has to be synchronous, but it can
 * create IndexedDB requests, and those requests' `onsuccess` handlers can
 * create further requests, and so forth; the transaction will be committed and
 * the promise resolved after such a task finishes with no further pending
 * requests. Such requests need not register `onerror` handlers, unless they
 * need to do fine-grained error handling; if an exception is thrown and not
 * caught, the transaction will be aborted without committing any writes.
 */
export async function useStore(
  txMode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => void,
  storeName: string = STORE_NAME
): Promise<boolean> {
  const db = await dbPromise;
  return new Promise((resolve) => {
    let tx: IDBTransaction;
    try {
      // The FLEDGE API does not offer callers any guarantees about when writes
      // will be committed; for example, `joinAdInterestGroup` has a synchronous
      // API that triggers a background task but does not allow the caller to
      // await that task. Therefore, strict durability is not required for
      // correctness. So we'll improve latency and user battery life by opting
      // into relaxed durability, which allows the browser and OS to economize
      // on potentially expensive writes to disk.
      tx = db.transaction(storeName, txMode, { durability: "relaxed" });
    } catch (error: unknown) {
      /* istanbul ignore else */
      if (error instanceof DOMException && error.name === "NotFoundError") {
        logError(error.message);
        resolve(false);
        return;
      } else {
        throw error;
      }
    }
    tx.oncomplete = () => {
      resolve(true);
    };
    tx.onabort = () => {
      if (tx.error) {
        logError(tx.error.message);
      }
      resolve(false);
    };
    // No need to explicitly install an onerror handler since an error aborts
    // the transaction.
    const store = tx.objectStore(storeName);
    try {
      callback(store);
    } catch (error: unknown) {
      tx.abort();
      throw error;
    }
  });
}

declare global {
  interface IDBDatabase {
    /**
     * The `options` parameter is in the IndexedDB spec and is supported by
     * Chrome, but is absent from the default TypeScript type definitions.
     *
     * @see https://www.w3.org/TR/IndexedDB/#database-interface
     */
    transaction(
      storeNames: string | Iterable<string>,
      mode?: IDBTransactionMode,
      options?: { durability?: "default" | "strict" | "relaxed" }
    ): IDBTransaction;
  }
}
