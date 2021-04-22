/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview CRUD operations on our data model for persistent storage in
 * idb-keyval, with runtime type checking.
 */

import * as idbKeyval from "idb-keyval";
import { isArray } from "../lib/shared/types";

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
 * Stores an interest group in idb-keyval. If there's already one with the same
 * name, it is overwritten.
 */
export function setInterestGroupAds(name: string, ads: Ad[]): Promise<void> {
  return idbKeyval.set(name, ads);
}

/** Deletes an interest group from idb-keyval. */
export function deleteInterestGroup(name: string): Promise<void> {
  return idbKeyval.del(name);
}

/** Returns all ads from all interest groups currently stored in idb-keyval. */
export function getAllAds(): Promise<
  Generator<Ad, /* TReturn= */ void, /* TNext= */ void>
> {
  return idbKeyval.entries().then(function* (entries) {
    for (const [key, ads] of entries) {
      function check(condition: boolean): asserts condition {
        if (!condition) {
          throw new Error(
            `Malformed entry in idb-keyval for ${JSON.stringify(
              key
            )}: ${JSON.stringify(ads)}`
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
