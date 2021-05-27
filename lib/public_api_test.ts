/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import "jasmine";
import { assertToBeTruthy } from "../testing/assert";
import {
  FakeRequest,
  FakeServerHandler,
  setFakeServerHandler,
} from "../testing/http";
import { create, renderingUrlFromAuctionResult } from "../testing/public_api";
import { clearStorageBeforeAndAfter } from "../testing/storage";

describe("FledgeShim", () => {
  clearStorageBeforeAndAfter();

  const name = "interest group name";

  describe("runAdAuction", () => {
    it("should return null if there are no interest groups", async () => {
      expect(await create().runAdAuction({})).toBeNull();
    });

    it("should return null if there are no ads in the interest groups", async () => {
      const fledgeShim = create();
      fledgeShim.joinAdInterestGroup({ name, ads: [] });
      expect(await fledgeShim.runAdAuction({})).toBeNull();
    });

    it("should return a single ad", async () => {
      const fledgeShim = create();
      const renderingUrl = "about:blank";
      fledgeShim.joinAdInterestGroup({
        name,
        ads: [{ renderingUrl, metadata: { price: 0.02 } }],
      });
      const token = await fledgeShim.runAdAuction({});
      assertToBeTruthy(token);
      expect(await renderingUrlFromAuctionResult(token)).toBe(renderingUrl);
    });

    it("should return the higher-priced ad from a single interest group", async () => {
      const fledgeShim = create();
      const renderingUrl = "about:blank#1";
      fledgeShim.joinAdInterestGroup({
        name,
        ads: [
          { renderingUrl: "about:blank#2", metadata: { price: 0.01 } },
          { renderingUrl, metadata: { price: 0.02 } },
        ],
      });
      const token = await fledgeShim.runAdAuction({});
      assertToBeTruthy(token);
      expect(await renderingUrlFromAuctionResult(token)).toBe(renderingUrl);
    });

    it("should return the higher-priced ad across multiple interest groups", async () => {
      const fledgeShim = create();
      const renderingUrl = "about:blank#1";
      fledgeShim.joinAdInterestGroup({
        name: "interest group 1",
        ads: [{ renderingUrl: "about:blank#2", metadata: { price: 0.01 } }],
      });
      fledgeShim.joinAdInterestGroup({
        name: "interest group 2",
        ads: [{ renderingUrl, metadata: { price: 0.02 } }],
      });
      const token = await fledgeShim.runAdAuction({});
      assertToBeTruthy(token);
      expect(await renderingUrlFromAuctionResult(token)).toBe(renderingUrl);
    });

    const trustedScoringSignalsUrl = "https://trusted-server.test/scoring";

    it("should fetch trusted scoring signals", async () => {
      const fledgeShim = create();
      fledgeShim.joinAdInterestGroup({
        name: "interest group 1",
        ads: [{ renderingUrl: "about:blank", metadata: { price: 0.02 } }],
      });
      const fakeServerHandler = jasmine
        .createSpy<FakeServerHandler>()
        .and.resolveTo({ body: '{"a": 1, "b": [true, null]}' });
      setFakeServerHandler(fakeServerHandler);
      await fledgeShim.runAdAuction({ trustedScoringSignalsUrl });
      expect(fakeServerHandler).toHaveBeenCalledOnceWith(
        jasmine.objectContaining<FakeRequest>({
          url: new URL(trustedScoringSignalsUrl + "?keys=about%3Ablank"),
          method: "GET",
          hasCredentials: false,
        })
      );
    });

    it("should not fetch trusted scoring signals if there are no ads", async () => {
      const fakeServerHandler = jasmine.createSpy();
      setFakeServerHandler(fakeServerHandler);
      await create().runAdAuction({ trustedScoringSignalsUrl });
      expect(fakeServerHandler).not.toHaveBeenCalled();
    });

    it("should reject on a non-HTTPS URL", () =>
      expectAsync(
        create().runAdAuction({
          trustedScoringSignalsUrl: "http://insecure-server.test/scoring",
        })
      ).toBeRejectedWithError());
  });

  describe("joinAdInterestGroup", () => {
    it("should overwrite old property values with new ones", async () => {
      const fledgeShim = create();
      const renderingUrl = "about:blank";
      fledgeShim.joinAdInterestGroup({
        name,
        ads: [{ renderingUrl, metadata: { price: 0.02 } }],
      });
      fledgeShim.joinAdInterestGroup({
        name,
        ads: [],
      });
      expect(await fledgeShim.runAdAuction({})).toBeNull();
    });

    it("should not overwrite old property values with undefined ones", async () => {
      const fledgeShim = create();
      const renderingUrl = "about:blank";
      fledgeShim.joinAdInterestGroup({
        name,
        ads: [{ renderingUrl, metadata: { price: 0.02 } }],
      });
      fledgeShim.joinAdInterestGroup({
        name,
        ads: undefined,
      });
      const token = await fledgeShim.runAdAuction({});
      assertToBeTruthy(token);
      expect(await renderingUrlFromAuctionResult(token)).toBe(renderingUrl);
    });
  });

  describe("leaveAdInterestGroup", () => {
    it("should prevent ads from appearing in the auction", async () => {
      const fledgeShim = create();
      const renderingUrl = "about:blank";
      fledgeShim.joinAdInterestGroup({
        name,
        ads: [{ renderingUrl, metadata: { price: 0.02 } }],
      });
      fledgeShim.leaveAdInterestGroup({ name });
      expect(await fledgeShim.runAdAuction({})).toBeNull();
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
      await expectAsync(fledgeShim.runAdAuction({})).toBeRejectedWithError();
    });
  });
});
