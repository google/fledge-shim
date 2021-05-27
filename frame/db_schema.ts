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
import { logWarning } from "./console";
import { useStore } from "./indexeddb";

/**
 * Analogous to {@link InterestGroup}, but all fields are required. This
 * represents an interest group as it is stored in the database.
 */
export interface CanonicalInterestGroup {
  name: string;
  ads: Ad[];
}

function interestGroupFromRecord(record: unknown, key: IDBValidKey) {
  function handleMalformedEntry() {
    logWarning("Malformed entry in IndexedDB for key:", [key, ":", record]);
    return null;
  }
  if (!(typeof key === "string" && isArray(record))) {
    return handleMalformedEntry();
  }
  const ads = [];
  for (const adRecord of record) {
    if (!(isArray(adRecord) && adRecord.length === 2)) {
      return handleMalformedEntry();
    }
    const [renderingUrl, price] = adRecord;
    if (!(typeof renderingUrl === "string" && typeof price === "number")) {
      return handleMalformedEntry();
    }
    ads.push({ renderingUrl, metadata: { price } });
  }
  return { name: key, ads };
}

function recordFromInterestGroup(group: CanonicalInterestGroup) {
  return group.ads
    ? group.ads.map(({ renderingUrl, metadata: { price } }) => [
        renderingUrl,
        price,
      ])
    : [];
}

/**
 * Stores an interest group in IndexedDB and returns whether it was committed
 * successfully. If there's already one with the same name, each property value
 * of the existing interest group is overwritten if the new interest group has a
 * defined value for that property, but left unchanged if it does not. Note that
 * there is no way to delete a property of an existing interest group without
 * overwriting it with a defined value or deleting the whole interest group.
 */
export function storeInterestGroup(group: InterestGroup): Promise<boolean> {
  return useStore("readwrite", (store) => {
    const { name } = group;
    const cursorRequest = store.openCursor(name);
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (cursor) {
        // It shouldn't be possible for the cursor key to differ from the
        // expected one.
        /* istanbul ignore if */
        if (cursor.key !== name) {
          throw new Error(`${String(cursor.key)},${name}`);
        }
        const oldGroup = interestGroupFromRecord(cursor.value, name) ?? {
          ads: [],
        };
        cursor.update(
          recordFromInterestGroup({
            name,
            ads: group.ads ?? oldGroup.ads,
          })
        );
      } else {
        store.add(
          recordFromInterestGroup({
            name,
            ads: group.ads ?? [],
          }),
          name
        );
      }
    };
  });
}

/**
 * Deletes an interest group from IndexedDB and returns whether it was committed
 * successfully. If there isn't one with the given name, does nothing.
 */
export function deleteInterestGroup(name: string): Promise<boolean> {
  return useStore("readwrite", (store) => {
    store.delete(name);
  });
}

/** Iteration callback type for `forEachInterestGroup`. */
export type InterestGroupCallback = (group: CanonicalInterestGroup) => void;

/**
 * Iterates over all interest groups currently stored in IndexedDB and returns
 * whether they were all read successfully.
 */
export function forEachInterestGroup(
  callback: InterestGroupCallback
): Promise<boolean> {
  return useStore("readonly", (store) => {
    const cursorRequest = store.openCursor();
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (!cursor) {
        return;
      }
      const group = interestGroupFromRecord(cursor.value, cursor.key);
      if (group) {
        callback(group);
      }
      cursor.continue();
    };
  });
}
