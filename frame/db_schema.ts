/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview CRUD operations on our data model for persistent storage in
 * IndexedDB, with runtime type checking.
 */

import { isArray } from "../lib/shared/types";
import { useStore } from "./indexeddb";

/** An `Ad` from the public API serialized into storage format. */
export type Ad = [renderingUrl: string, price: number];

function isInterestGroupAd(value: unknown): value is Ad {
  if (!isArray(value) || value.length !== 2) {
    return false;
  }
  const [renderingUrl, cpmInUsd] = value;
  return typeof renderingUrl === "string" && typeof cpmInUsd === "number";
}

/**
 * Stores an interest group in IndexedDB. If there's already one with the same
 * name, it is overwritten.
 */
export function setInterestGroupAds(name: string, ads: Ad[]): Promise<void> {
  return useStore("readwrite", (store) => {
    store.put(ads, name);
  });
}

/** Deletes an interest group from IndexedDB. */
export function deleteInterestGroup(name: string): Promise<void> {
  return useStore("readwrite", (store) => {
    store.delete(name);
  });
}

/** Returns all ads from all interest groups currently stored in IndexedDB. */
export function getAllAds(): Promise<
  Generator<Ad, /* TReturn= */ void, /* TNext= */ void>
> {
  let interestGroups: unknown[];
  return useStore("readonly", (store) => {
    const cursor = store.getAll();
    cursor.onsuccess = () => {
      interestGroups = cursor.result;
    };
  }).then(function* () {
    for (const ads of interestGroups) {
      function check(condition: boolean): asserts condition {
        if (!condition) {
          throw new Error(
            `Malformed entry in IndexedDB: ${JSON.stringify(ads)}`
          );
        }
      }
      check(isArray(ads));
      for (const ad of ads) {
        check(isInterestGroupAd(ad));
        yield ad;
      }
    }
  });
}
