/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import "jasmine";
import { clearStorageBeforeAndAfter } from "../testing/storage";
import {
  deleteInterestGroup,
  getAllAds,
  storeInterestGroup,
} from "./db_schema";
import { useStore } from "./indexeddb";

describe("db_schema:", () => {
  clearStorageBeforeAndAfter();

  describe("getAllAds", () => {
    it("should read an ad from IndexedDB", async () => {
      const ads = [{ renderingUrl: "about:blank", metadata: { price: 0.02 } }];
      await storeInterestGroup({ name: "interest group name", ads });
      expect([...(await getAllAds())]).toEqual(ads);
    });

    it("should read ads from multiple entries in IndexedDB", async () => {
      await useStore("readwrite", (store) => {
        store.add([["about:blank#1", 0.01]], "interest group name 1");
        store.add([], "interest group name 2");
        store.add(
          [
            ["about:blank#2", 0.02],
            ["about:blank#3", 0.03],
          ],
          "interest group name 3"
        );
      });
      expect([...(await getAllAds())]).toEqual([
        { renderingUrl: "about:blank#1", metadata: { price: 0.01 } },
        { renderingUrl: "about:blank#2", metadata: { price: 0.02 } },
        { renderingUrl: "about:blank#3", metadata: { price: 0.03 } },
      ]);
    });
  });

  describe("storeInterestGroup", () => {
    it("should write an ad that can then be read", async () => {
      const name = "interest group name";
      const ads = [{ renderingUrl: "about:blank", metadata: { price: 0.02 } }];
      await storeInterestGroup({ name, ads });
      expect([...(await getAllAds())]).toEqual(ads);
    });

    it("should overwrite an existing ad", async () => {
      const name = "interest group name";
      await storeInterestGroup({
        name,
        ads: [{ renderingUrl: "about:blank#1", metadata: { price: 0.01 } }],
      });
      const ads = [{ renderingUrl: "about:blank", metadata: { price: 0.02 } }];
      await storeInterestGroup({ name, ads });
      expect([...(await getAllAds())]).toEqual(ads);
    });
  });

  describe("deleteInterestGroup", () => {
    it("should delete an interest group whose ads then no longer appear", async () => {
      const ads = [
        { renderingUrl: "about:blank#1", metadata: { price: 0.01 } },
      ];
      await storeInterestGroup({ name: "interest group name 1", ads });
      const name = "interest group name 2";
      await storeInterestGroup({
        name,
        ads: [{ renderingUrl: "about:blank#2", metadata: { price: 0.02 } }],
      });
      await deleteInterestGroup(name);
      expect([...(await getAllAds())]).toEqual(ads);
    });

    it("should do nothing when deleting a nonexistent interest group", async () => {
      await deleteInterestGroup("interest group name");
      expect([...(await getAllAds())]).toEqual([]);
    });
  });
});
