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
  const biddingLogicUrl = "https://dsp.example/bidding.js";
  const trustedBiddingSignalsUrl = "https://trusted-server.test/bidding";

  describe("forEachInterestGroup", () => {
    it("should read an interest group from IndexedDB", async () => {
      const group = {
        name,
        biddingLogicUrl,
        trustedBiddingSignalsUrl,
        ads: [{ renderUrl: "about:blank", metadata: { "price": 0.02 } }],
      };
      expect(await storeInterestGroup(group)).toBeTrue();
      const callback = jasmine.createSpy<InterestGroupCallback>("callback");
      expect(await forEachInterestGroup(callback)).toBeTrue();
      expect(callback).toHaveBeenCalledOnceWith(group);
    });

    it("should read multiple interest groups from IndexedDB", async () => {
      expect(
        await useStore("readwrite", (store) => {
          store.add(
            [
              biddingLogicUrl,
              trustedBiddingSignalsUrl,
              [["about:blank#1", { "price": 0.01 }]],
            ],
            "interest group name 1"
          );
          store.add(
            [
              "https://dsp-2.example/bidding.js",
              "https://trusted-server-2.test/bidding",
              [],
            ],
            "interest group name 2"
          );
          store.add(
            [
              /* biddingLogicUrl= */ undefined,
              /* trustedBiddingSignalsUrl= */ undefined,
              [
                ["about:blank#2", []],
                ["about:blank#3", undefined],
              ],
            ],
            "interest group name 3"
          );
        })
      ).toBeTrue();
      const callback = jasmine.createSpy<InterestGroupCallback>("callback");
      expect(await forEachInterestGroup(callback)).toBeTrue();
      expect(callback).toHaveBeenCalledTimes(3);
      expect(callback).toHaveBeenCalledWith({
        name: "interest group name 1",
        biddingLogicUrl,
        trustedBiddingSignalsUrl,
        ads: [{ renderUrl: "about:blank#1", metadata: { "price": 0.01 } }],
      });
      expect(callback).toHaveBeenCalledWith({
        name: "interest group name 2",
        biddingLogicUrl: "https://dsp-2.example/bidding.js",
        trustedBiddingSignalsUrl: "https://trusted-server-2.test/bidding",
        ads: [],
      });
      expect(callback).toHaveBeenCalledWith({
        name: "interest group name 3",
        biddingLogicUrl: undefined,
        trustedBiddingSignalsUrl: undefined,
        ads: [
          { renderUrl: "about:blank#2", metadata: [] },
          { renderUrl: "about:blank#3", metadata: undefined },
        ],
      });
    });
  });

  describe("storeInterestGroup", () => {
    it("should write an ad that can then be read", async () => {
      const group = {
        name,
        biddingLogicUrl,
        trustedBiddingSignalsUrl,
        ads: [{ renderUrl: "about:blank", metadata: { "price": 0.02 } }],
      };
      expect(await storeInterestGroup(group)).toBeTrue();
      const callback = jasmine.createSpy<InterestGroupCallback>("callback");
      expect(await forEachInterestGroup(callback)).toBeTrue();
      expect(callback).toHaveBeenCalledOnceWith(group);
    });

    it("should write an ad without all fields present", async () => {
      expect(await storeInterestGroup({ name })).toBeTrue();
      const callback = jasmine.createSpy<InterestGroupCallback>("callback");
      expect(await forEachInterestGroup(callback)).toBeTrue();
      expect(callback).toHaveBeenCalledOnceWith({
        name,
        biddingLogicUrl: undefined,
        trustedBiddingSignalsUrl: undefined,
        ads: [],
      });
    });

    it("should overwrite all fields of an existing ad", async () => {
      expect(
        await storeInterestGroup({
          name,
          biddingLogicUrl: "https://dsp-1.example/bidding.js",
          trustedBiddingSignalsUrl: "https://trusted-server-1.test/bidding",
          ads: [{ renderUrl: "about:blank#1", metadata: { "price": 0.01 } }],
        })
      ).toBeTrue();
      expect(
        await storeInterestGroup({
          name,
          biddingLogicUrl: "https://dsp-2.example/bidding.js",
          trustedBiddingSignalsUrl: "https://trusted-server-2.test/bidding",
          ads: [{ renderUrl: "about:blank#2", metadata: { "price": 0.02 } }],
        })
      ).toBeTrue();
      const callback = jasmine.createSpy<InterestGroupCallback>("callback");
      expect(await forEachInterestGroup(callback)).toBeTrue();
      expect(callback).toHaveBeenCalledOnceWith({
        name,
        biddingLogicUrl: "https://dsp-2.example/bidding.js",
        trustedBiddingSignalsUrl: "https://trusted-server-2.test/bidding",
        ads: [{ renderUrl: "about:blank#2", metadata: { "price": 0.02 } }],
      });
    });

    it("should overwrite some fields of an existing ad", async () => {
      expect(
        await storeInterestGroup({
          name,
          biddingLogicUrl,
          trustedBiddingSignalsUrl: "https://trusted-server-1.test/bidding",
          ads: [{ renderUrl: "about:blank#1", metadata: { "price": 0.01 } }],
        })
      ).toBeTrue();
      expect(
        await storeInterestGroup({
          name,
          trustedBiddingSignalsUrl: "https://trusted-server-2.test/bidding",
        })
      ).toBeTrue();
      const callback = jasmine.createSpy<InterestGroupCallback>("callback");
      expect(await forEachInterestGroup(callback)).toBeTrue();
      expect(callback).toHaveBeenCalledOnceWith({
        name,
        biddingLogicUrl,
        trustedBiddingSignalsUrl: "https://trusted-server-2.test/bidding",
        ads: [{ renderUrl: "about:blank#1", metadata: { "price": 0.01 } }],
      });
    });
  });

  describe("deleteInterestGroup", () => {
    it("should delete an interest group", async () => {
      expect(
        await storeInterestGroup({
          name: "interest group name 1",
          biddingLogicUrl: "https://dsp-1.example/bidding.js",
          trustedBiddingSignalsUrl: "https://trusted-server-1.test/bidding",
          ads: [{ renderUrl: "about:blank#1", metadata: { "price": 0.01 } }],
        })
      ).toBeTrue();
      expect(
        await storeInterestGroup({
          name: "interest group name 2",
          biddingLogicUrl: "https://dsp-2.example/bidding.js",
          trustedBiddingSignalsUrl: "https://trusted-server-2.test/bidding",
          ads: [{ renderUrl: "about:blank#2", metadata: { "price": 0.02 } }],
        })
      ).toBeTrue();
      expect(await deleteInterestGroup("interest group name 2")).toBeTrue();
      const callback = jasmine.createSpy<InterestGroupCallback>("callback");
      expect(await forEachInterestGroup(callback)).toBeTrue();
      expect(callback).toHaveBeenCalledOnceWith({
        name: "interest group name 1",
        biddingLogicUrl: "https://dsp-1.example/bidding.js",
        trustedBiddingSignalsUrl: "https://trusted-server-1.test/bidding",
        ads: [{ renderUrl: "about:blank#1", metadata: { "price": 0.01 } }],
      });
    });

    it("should do nothing when deleting a nonexistent interest group", async () => {
      expect(await deleteInterestGroup("interest group name")).toBeTrue();
      const callback = jasmine.createSpy<InterestGroupCallback>("callback");
      expect(await forEachInterestGroup(callback)).toBeTrue();
      expect(callback).not.toHaveBeenCalled();
    });
  });
});
