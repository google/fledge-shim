/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/** @fileoverview */

import * as idbKeyval from "idb-keyval";
import { isArray } from "../lib/shared/types";

/** TODO */
export type Ad = [renderingUrl: string, cpmInUsd: number];

function isInterestGroupAd(value: unknown): value is Ad {
  if (!isArray(value) || value.length !== 2) {
    return false;
  }
  const [renderingUrl, cpmInUsd] = value;
  return typeof renderingUrl === "string" && typeof cpmInUsd === "number";
}

/** */
export function setInterestGroupAds(name: string, ads: Ad[]): Promise<void> {
  return idbKeyval.set(name, ads);
}

/** */
export function deleteInterestGroup(name: string): Promise<void> {
  return idbKeyval.del(name);
}

/** */
export function getAllAds(): Promise<
  Generator<Ad, /* TReturn= */ void, /* TNext= */ void>
> {
  return idbKeyval.entries().then(function* (entries) {
    for (const [key, ads] of entries) {
      function check(condition: boolean): asserts condition {
        if (!condition) {
          throw new Error(
            `Malformed entry in IndexedDB for ${JSON.stringify(
              key
            )}: ${JSON.stringify(ads)}`
          );
        }
      }
      check(Array.isArray(ads));
      for (const ad of ads) {
        check(isInterestGroupAd(ad));
        yield ad;
      }
    }
  });
}
