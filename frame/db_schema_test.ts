/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import "jasmine";
import { clearStorageBeforeAndAfter } from "../testing/storage";
import {
  deleteInterestGroup,
  forEachInterestGroup,
  InterestGroupCallback,
  storeInterestGroup,
} from "./db_schema";
import { useStore } from "./indexeddb";

describe("db_schema:", () => {
  clearStorageBeforeAndAfter();

  const name = "interest group name";

  describe("forEachInterestGroup", () => {
    it("should read an interest group from IndexedDB", async () => {
      const group = {
        name,
        ads: [{ renderingUrl: "about:blank", metadata: { price: 0.02 } }],
      };
      expect(await storeInterestGroup(group)).toBeTrue();
      const callback = jasmine.createSpy<InterestGroupCallback>();
      expect(await forEachInterestGroup(callback)).toBeTrue();
      expect(callback).toHaveBeenCalledOnceWith(group);
    });

    it("should read multiple interest groups from IndexedDB", async () => {
      expect(
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
        })
      ).toBeTrue();
      const callback = jasmine.createSpy<InterestGroupCallback>();
      expect(await forEachInterestGroup(callback)).toBeTrue();
      expect(callback).toHaveBeenCalledTimes(3);
      expect(callback).toHaveBeenCalledWith({
        name: "interest group name 1",
        ads: [{ renderingUrl: "about:blank#1", metadata: { price: 0.01 } }],
      });
      expect(callback).toHaveBeenCalledWith({
        name: "interest group name 2",
        ads: [],
      });
      expect(callback).toHaveBeenCalledWith({
        name: "interest group name 3",
        ads: [
          { renderingUrl: "about:blank#2", metadata: { price: 0.02 } },
          { renderingUrl: "about:blank#3", metadata: { price: 0.03 } },
        ],
      });
    });
  });

  describe("storeInterestGroup", () => {
    it("should write an ad that can then be read", async () => {
      const group = {
        name,
        ads: [{ renderingUrl: "about:blank", metadata: { price: 0.02 } }],
      };
      expect(await storeInterestGroup(group)).toBeTrue();
      const callback = jasmine.createSpy<InterestGroupCallback>();
      expect(await forEachInterestGroup(callback)).toBeTrue();
      expect(callback).toHaveBeenCalledOnceWith(group);
    });

    it("should write an ad without all fields present", async () => {
      expect(await storeInterestGroup({ name })).toBeTrue();
      const callback = jasmine.createSpy<InterestGroupCallback>();
      expect(await forEachInterestGroup(callback)).toBeTrue();
      expect(callback).toHaveBeenCalledOnceWith({
        name,
        ads: [],
      });
    });

    it("should overwrite an existing ad", async () => {
      expect(
        await storeInterestGroup({
          name,
          ads: [{ renderingUrl: "about:blank#1", metadata: { price: 0.01 } }],
        })
      ).toBeTrue();
      expect(
        await storeInterestGroup({
          name,
          ads: [{ renderingUrl: "about:blank#2", metadata: { price: 0.02 } }],
        })
      ).toBeTrue();
      const callback = jasmine.createSpy<InterestGroupCallback>();
      expect(await forEachInterestGroup(callback)).toBeTrue();
      expect(callback).toHaveBeenCalledOnceWith({
        name,
        ads: [{ renderingUrl: "about:blank#2", metadata: { price: 0.02 } }],
      });
    });
  });

  describe("deleteInterestGroup", () => {
    it("should delete an interest group", async () => {
      expect(
        await storeInterestGroup({
          name: "interest group name 1",
          ads: [{ renderingUrl: "about:blank#1", metadata: { price: 0.01 } }],
        })
      ).toBeTrue();
      expect(
        await storeInterestGroup({
          name: "interest group name 2",
          ads: [{ renderingUrl: "about:blank#2", metadata: { price: 0.02 } }],
        })
      ).toBeTrue();
      expect(await deleteInterestGroup("interest group name 2")).toBeTrue();
      const callback = jasmine.createSpy<InterestGroupCallback>();
      expect(await forEachInterestGroup(callback)).toBeTrue();
      expect(callback).toHaveBeenCalledOnceWith({
        name: "interest group name 1",
        ads: [{ renderingUrl: "about:blank#1", metadata: { price: 0.01 } }],
      });
    });

    it("should do nothing when deleting a nonexistent interest group", async () => {
      expect(await deleteInterestGroup("interest group name")).toBeTrue();
      const callback = jasmine.createSpy<InterestGroupCallback>();
      expect(await forEachInterestGroup(callback)).toBeTrue();
      expect(callback).not.toHaveBeenCalled();
    });
  });
});
