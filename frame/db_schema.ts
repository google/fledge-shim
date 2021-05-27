/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview CRUD operations on our data model for persistent storage in
 * IndexedDB, with runtime type checking.
 */

import { Ad, InterestGroup } from "../lib/shared/api_types";
import { isArray } from "../lib/shared/guards";
import { useStore } from "./indexeddb";

/** An `Ad` from the public API serialized into storage format. */
type AdRecord = [renderingUrl: string, price: number];

function isAdRecord(value: unknown): value is AdRecord {
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
export async function storeInterestGroup({
  name,
  ads,
}: InterestGroup): Promise<void> {
  if (ads) {
    await useStore("readwrite", (store) => {
      store.put(
        ads.map(({ renderingUrl, metadata: { price } }) => {
          const adRecord: AdRecord = [renderingUrl, price];
          return adRecord;
        }),
        name
      );
    });
  }
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
        check(isAdRecord(ad));
        const [renderingUrl, price] = ad;
        yield { renderingUrl, metadata: { price } };
      }
    }
  });
}
