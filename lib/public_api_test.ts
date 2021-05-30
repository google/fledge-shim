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
import { create, renderUrlFromAuctionResult } from "../testing/public_api";
import { clearStorageBeforeAndAfter } from "../testing/storage";
import { FledgeShim } from "./public_api";

describe("FledgeShim", () => {
  clearStorageBeforeAndAfter();

  describe("constructor", () => {
    it("should throw on an ill-formed URL", () => {
      expect(() => {
        new FledgeShim("//not:valid");
      }).toThrowError(/.*\/\/not:valid.*/);
    });

    it("should throw on a non-HTTP URL", () => {
      expect(() => {
        new FledgeShim("data:text/html,<!DOCTYPE html><title>Page</title>");
      }).toThrowError(
        /.*data:text\/html,<!DOCTYPE html><title>Page<\/title>.*/
      );
    });

    it("should throw on a URL with a fragment", () => {
      expect(() => {
        new FledgeShim("/frame.html#fragment");
      }).toThrowError(/.*\/frame\.html#fragment.*/);
    });

    it("should throw on a URL with an empty fragment", () => {
      expect(() => {
        new FledgeShim("/frame.html#");
      }).toThrowError(/.*\/frame\.html#.*/);
    });

    it("should create an invisible iframe", () => {
      create();
      const iframe = document.querySelector("iframe");
      assertToBeTruthy(iframe);
      expect(iframe.src).toBe(new URL("/frame.html", document.baseURI).href);
      expect(getComputedStyle(iframe).display).toBe("none");
    });

    it("should create a sandboxed iframe", () => {
      create();
      const iframe = document.querySelector("iframe");
      assertToBeTruthy(iframe);
      expect(iframe.src).toBe(new URL("/frame.html", document.baseURI).href);
      assertToBeTruthy(iframe.contentDocument);
      // Try to navigate the top window from within the iframe. If this
      // succeeds, it will break the connection between the page and the Karma
      // server, which will cause the test to fail. However, it should not
      // succeed because the iframe should be sandboxed without
      // allow-top-navigation.
      const script = iframe.contentDocument.createElement("script");
      script.textContent = "top.location.pathname = '/favicon.ico';";
      iframe.contentDocument.head.appendChild(script);
    });
  });

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
      const renderUrl = "about:blank";
      fledgeShim.joinAdInterestGroup({
        name,
        ads: [{ renderUrl, metadata: { price: 0.02 } }],
      });
      const token = await fledgeShim.runAdAuction({});
      assertToBeTruthy(token);
      expect(await renderUrlFromAuctionResult(token)).toBe(renderUrl);
    });

    it("should return the higher-priced ad from a single interest group", async () => {
      const fledgeShim = create();
      const renderUrl = "about:blank#1";
      fledgeShim.joinAdInterestGroup({
        name,
        ads: [
          { renderUrl: "about:blank#2", metadata: { price: 0.01 } },
          { renderUrl, metadata: { price: 0.02 } },
        ],
      });
      const token = await fledgeShim.runAdAuction({});
      assertToBeTruthy(token);
      expect(await renderUrlFromAuctionResult(token)).toBe(renderUrl);
    });

    it("should return the higher-priced ad across multiple interest groups", async () => {
      const fledgeShim = create();
      const renderUrl = "about:blank#1";
      fledgeShim.joinAdInterestGroup({
        name: "interest group 1",
        ads: [{ renderUrl: "about:blank#2", metadata: { price: 0.01 } }],
      });
      fledgeShim.joinAdInterestGroup({
        name: "interest group 2",
        ads: [{ renderUrl, metadata: { price: 0.02 } }],
      });
      const token = await fledgeShim.runAdAuction({});
      assertToBeTruthy(token);
      expect(await renderUrlFromAuctionResult(token)).toBe(renderUrl);
    });

    const trustedBiddingSignalsUrl = "https://trusted-server.test/bidding";
    const trustedScoringSignalsUrl = "https://trusted-server.test/scoring";

    it("should fetch trusted bidding and scoring signals", async () => {
      const fledgeShim = create();
      fledgeShim.joinAdInterestGroup({
        name: "interest group 1",
        trustedBiddingSignalsUrl,
        ads: [{ renderUrl: "about:blank", metadata: { price: 0.02 } }],
      });
      const fakeServerHandler = jasmine
        .createSpy<FakeServerHandler>()
        .and.resolveTo({ body: '{"a": 1, "b": [true, null]}' });
      setFakeServerHandler(fakeServerHandler);
      await fledgeShim.runAdAuction({ trustedScoringSignalsUrl });
      expect(fakeServerHandler).toHaveBeenCalledTimes(2);
      expect(fakeServerHandler).toHaveBeenCalledWith(
        jasmine.objectContaining<FakeRequest>({
          url: new URL(
            trustedBiddingSignalsUrl +
              `?hostname=${encodeURIComponent(location.hostname)}`
          ),
          method: "GET",
          hasCredentials: false,
        })
      );
      expect(fakeServerHandler).toHaveBeenCalledWith(
        jasmine.objectContaining<FakeRequest>({
          url: new URL(trustedScoringSignalsUrl + "?keys=about%3Ablank"),
          method: "GET",
          hasCredentials: false,
        })
      );
    });

    it("should not fetch trusted scoring signals if there are no ads", async () => {
      const fakeServerHandler =
        jasmine.createSpy<FakeServerHandler>("fakeServerHandler");
      setFakeServerHandler(fakeServerHandler);
      await create().runAdAuction({ trustedScoringSignalsUrl });
      expect(fakeServerHandler).not.toHaveBeenCalled();
    });

    it("should reject on an ill-formed URL", () =>
      expectAsync(
        create().runAdAuction({
          trustedScoringSignalsUrl: "This string is not a URL.",
        })
      ).toBeRejectedWithError(/.*This string is not a URL\..*/));

    it("should reject on a non-HTTPS URL", () =>
      expectAsync(
        create().runAdAuction({
          trustedScoringSignalsUrl: "http://insecure-server.test/scoring",
        })
      ).toBeRejectedWithError(/.*http:\/\/insecure-server\.test\/scoring.*/));

    it("should reject on a URL with a query string", () =>
      expectAsync(
        create().runAdAuction({
          trustedScoringSignalsUrl: trustedScoringSignalsUrl + "?key=value",
        })
      ).toBeRejectedWithError(
        /.*https:\/\/trusted-server\.test\/scoring\?key=value.*/
      ));
  });

  describe("joinAdInterestGroup", () => {
    it("should overwrite old property values with new ones", async () => {
      const fledgeShim = create();
      const renderUrl = "about:blank";
      fledgeShim.joinAdInterestGroup({
        name,
        ads: [{ renderUrl, metadata: { price: 0.02 } }],
      });
      fledgeShim.joinAdInterestGroup({
        name,
        ads: [],
      });
      expect(await fledgeShim.runAdAuction({})).toBeNull();
    });

    it("should not overwrite old property values with undefined ones", async () => {
      const fledgeShim = create();
      const renderUrl = "about:blank";
      fledgeShim.joinAdInterestGroup({
        name,
        ads: [{ renderUrl, metadata: { price: 0.02 } }],
      });
      fledgeShim.joinAdInterestGroup({
        name,
        ads: undefined,
      });
      const token = await fledgeShim.runAdAuction({});
      assertToBeTruthy(token);
      expect(await renderUrlFromAuctionResult(token)).toBe(renderUrl);
    });
  });

  describe("leaveAdInterestGroup", () => {
    it("should prevent ads from appearing in the auction", async () => {
      const fledgeShim = create();
      fledgeShim.joinAdInterestGroup({
        name,
        ads: [{ renderUrl: "about:blank", metadata: { price: 0.02 } }],
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
