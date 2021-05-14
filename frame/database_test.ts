/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import "jasmine";
import * as idbKeyval from "idb-keyval";
import { clearStorageBeforeAndAfter } from "../testing/storage";
import {
  Ad,
  deleteInterestGroup,
  getAllAds,
  setInterestGroupAds,
} from "./database";

describe("database:", () => {
  clearStorageBeforeAndAfter();

  describe("getAllAds", () => {
    it("should read an ad from idb-keyval", async () => {
      const ads: Ad[] = [["about:blank", 0.02]];
      await setInterestGroupAds("interest group name", ads);
      expect([...(await getAllAds())]).toEqual(ads);
    });

    it("should read ads from multiple entries in idb-keyval", async () => {
      const ad1: Ad = ["about:blank#1", 0.01];
      const ad2: Ad = ["about:blank#2", 0.02];
      const ad3: Ad = ["about:blank#3", 0.03];
      await idbKeyval.set("interest group name 1", [ad1]);
      await idbKeyval.set("interest group name 2", []);
      await idbKeyval.set("interest group name 3", [ad2, ad3]);
      expect([...(await getAllAds())]).toEqual([ad1, ad2, ad3]);
    });
  });

  describe("setInterestGroupAds", () => {
    it("should write an ad that can then be read", async () => {
      const name = "interest group name";
      const ads: Ad[] = [["about:blank", 0.02]];
      await setInterestGroupAds(name, ads);
      expect([...(await getAllAds())]).toEqual(ads);
    });

    it("should overwrite an existing ad", async () => {
      const name = "interest group name";
      await setInterestGroupAds(name, [["about:blank#1", 0.01]]);
      const ads: Ad[] = [["about:blank", 0.02]];
      await setInterestGroupAds(name, ads);
      expect([...(await getAllAds())]).toEqual(ads);
    });
  });

  describe("setInterestGroupAds", () => {
    it("should delete an interest group whose ads then no longer appear", async () => {
      const ads: Ad[] = [["about:blank#1", 0.01]];
      await setInterestGroupAds("interest group name 1", ads);
      const name = "interest group name 2";
      await setInterestGroupAds(name, [["about:blank#2", 0.02]]);
      await deleteInterestGroup(name);
      expect([...(await getAllAds())]).toEqual(ads);
    });

    it("should do nothing when deleting a nonexistent interest group", async () => {
      await deleteInterestGroup("interest group name");
      expect([...(await getAllAds())]).toEqual([]);
    });
  });
});
