/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import "jasmine";
import { nonNullish } from "./shared/types";
import { clearStorageBeforeAndAfter } from "./shared/testing/storage";
import { create, renderingUrlFromAuctionResult } from "./testing/public_api";

describe("FledgeShim", () => {
  clearStorageBeforeAndAfter();

  const name = "interest group name";

  describe("runAdAuction", () => {
    it("should return null if there are no interest groups", async () => {
      expect(await create().runAdAuction()).toBeNull();
    });

    it("should return null if there are no ads in the interest groups", async () => {
      const fledgeShim = create();
      fledgeShim.joinAdInterestGroup({ name, ads: [] });
      expect(await fledgeShim.runAdAuction()).toBeNull();
    });

    it("should return a single ad", async () => {
      const fledgeShim = create();
      const renderingUrl = "about:blank";
      fledgeShim.joinAdInterestGroup({
        name,
        ads: [{ rendering_url: renderingUrl, metadata: { price: 0.02 } }],
      });
      expect(
        await renderingUrlFromAuctionResult(
          nonNullish(await fledgeShim.runAdAuction())
        )
      ).toBe(renderingUrl);
    });

    it("should return the higher-priced ad from a single interest group", async () => {
      const fledgeShim = create();
      const renderingUrl = "about:blank#1";
      fledgeShim.joinAdInterestGroup({
        name,
        ads: [
          { rendering_url: "about:blank#2", metadata: { price: 0.01 } },
          { rendering_url: renderingUrl, metadata: { price: 0.02 } },
        ],
      });
      expect(
        await renderingUrlFromAuctionResult(
          nonNullish(await fledgeShim.runAdAuction())
        )
      ).toBe(renderingUrl);
    });

    it("should return the higher-priced ad from a single interest group", async () => {
      const fledgeShim = create();
      const renderingUrl = "about:blank#1";
      fledgeShim.joinAdInterestGroup({
        name,
        ads: [
          { rendering_url: "about:blank#2", metadata: { price: 0.01 } },
          { rendering_url: renderingUrl, metadata: { price: 0.02 } },
        ],
      });
      expect(
        await renderingUrlFromAuctionResult(
          nonNullish(await fledgeShim.runAdAuction())
        )
      ).toBe(renderingUrl);
    });
  });

  describe("leaveAdInterestGroup", () => {
    it("should prevent ads from appearing in the auction", async () => {
      const fledgeShim = create();
      const renderingUrl = "about:blank";
      fledgeShim.joinAdInterestGroup({
        name,
        ads: [{ rendering_url: renderingUrl, metadata: { price: 0.02 } }],
      });
      fledgeShim.leaveAdInterestGroup({ name });
      expect(await fledgeShim.runAdAuction()).toBeNull();
    });
  });

  describe("destroy", () => {
    it("should put the FledgeShim in a destroyed state", async () => {
      const fledgeShim = create();
      expect(fledgeShim.isDestroyed()).toBeFalse();
      fledgeShim.destroy();
      expect(fledgeShim.isDestroyed()).toBeTrue();
      expect(() => {
        fledgeShim.destroy();
      }).toThrowError();
      expect(() => {
        fledgeShim.joinAdInterestGroup({ name, ads: [] });
      }).toThrowError();
      expect(() => {
        fledgeShim.leaveAdInterestGroup({ name });
      }).toThrowError();
      await expectAsync(fledgeShim.runAdAuction()).toBeRejectedWithError();
    });
  });
});
