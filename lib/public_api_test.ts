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
  const biddingLogicUrl = "https://dsp.test/bidder.js";
  const decisionLogicUrl = "https://ssp.test/scorer.js";

  describe("runAdAuction", () => {
    it("should return null if there are no interest groups", async () => {
      expect(await create().runAdAuction({ decisionLogicUrl })).toBeNull();
    });

    it("should return null if there are no ads in the interest groups", async () => {
      const fledgeShim = create();
      fledgeShim.joinAdInterestGroup({ name, ads: [] });
      expect(await fledgeShim.runAdAuction({ decisionLogicUrl })).toBeNull();
    });

    it("should return a single ad", async () => {
      const fakeServerHandler =
        jasmine.createSpy<FakeServerHandler>("fakeServerHandler");
      fakeServerHandler
        .withArgs(
          jasmine.objectContaining<FakeRequest>({
            url: new URL(biddingLogicUrl),
          })
        )
        .and.resolveTo({
          headers: {
            "Content-Type": "application/javascript",
            "X-Allow-FLEDGE": "true",
          },
          body: [
            "function generateBid({",
            "  name,",
            "  biddingLogicUrl,",
            "  trustedBiddingSignalsUrl,",
            "  ads,",
            "}) {",
            "  if (",
            "    !(",
            "      name === 'interest group name' &&",
            "      biddingLogicUrl === 'https://dsp.test/bidder.js' &&",
            "      trustedBiddingSignalsUrl === undefined &&",
            "      ads.length === 1 &&",
            "      ads[0].renderUrl === 'about:blank' &&",
            "      ads[0].metadata['price'] === 0.02",
            "    )",
            "  ) {",
            "    throw new Error();",
            "  }",
            "  return {",
            "    ad: { 'arbitraryKey': 'arbitrary value' },",
            "    bid: 0.03,",
            "    render: 'about:blank',",
            "  };",
            "}",
          ].join("\n"),
        });
      fakeServerHandler
        .withArgs(
          jasmine.objectContaining<FakeRequest>({
            url: new URL(decisionLogicUrl),
          })
        )
        .and.resolveTo({
          headers: {
            "Content-Type": "application/javascript",
            "X-Allow-FLEDGE": "true",
          },
          body: [
            "function scoreAd(",
            "  adMetadata,",
            "  bid,",
            "  { decisionLogicUrl, trustedScoringSignalsUrl }",
            ") {",
            "  if (",
            "    !(",
            "      adMetadata['arbitraryKey'] === 'arbitrary value' &&",
            "      bid === 0.03 &&",
            "      decisionLogicUrl === 'https://ssp.test/scorer.js' &&",
            "      trustedScoringSignalsUrl === undefined",
            "    )",
            "  ) {",
            "    throw new Error();",
            "  }",
            "  return 10;",
            "}",
          ].join("\n"),
        });
      setFakeServerHandler(fakeServerHandler);
      const fledgeShim = create();
      const renderUrl = "about:blank";
      fledgeShim.joinAdInterestGroup({
        name,
        biddingLogicUrl,
        ads: [{ renderUrl, metadata: { "price": 0.02 } }],
      });
      const token = await fledgeShim.runAdAuction({ decisionLogicUrl });
      assertToBeTruthy(token);
      expect(await renderUrlFromAuctionResult(token)).toBe(renderUrl);
      expect(fakeServerHandler).toHaveBeenCalledTimes(2);
      expect(fakeServerHandler).toHaveBeenCalledWith(
        jasmine.objectContaining<FakeRequest>({
          url: new URL(biddingLogicUrl),
          method: "GET",
          headers: jasmine.objectContaining<{ [name: string]: string }>({
            "accept": "application/javascript",
          }),
          body: Uint8Array.of(),
          hasCredentials: false,
        })
      );
      expect(fakeServerHandler).toHaveBeenCalledWith(
        jasmine.objectContaining<FakeRequest>({
          url: new URL(decisionLogicUrl),
          method: "GET",
          headers: jasmine.objectContaining<{ [name: string]: string }>({
            "accept": "application/javascript",
          }),
          body: Uint8Array.of(),
          hasCredentials: false,
        })
      );
    });

    it("should return the bidder-selected ad from a single interest group", async () => {
      const fakeServerHandler =
        jasmine.createSpy<FakeServerHandler>("fakeServerHandler");
      fakeServerHandler
        .withArgs(
          jasmine.objectContaining<FakeRequest>({
            url: new URL(biddingLogicUrl),
          })
        )
        .and.resolveTo({
          headers: {
            "Content-Type": "application/javascript",
            "X-Allow-FLEDGE": "true",
          },
          body: [
            "function generateBid({",
            "  name,",
            "  biddingLogicUrl,",
            "  trustedBiddingSignalsUrl,",
            "  ads,",
            "}) {",
            "  if (",
            "    !(",
            "      name === 'interest group name' &&",
            "      biddingLogicUrl === 'https://dsp.test/bidder.js' &&",
            "      trustedBiddingSignalsUrl === undefined &&",
            "      ads.length === 2 &&",
            "      ads[0].renderUrl === 'about:blank#2' &&",
            "      ads[0].metadata['price'] === 0.01 &&",
            "      ads[1].renderUrl === 'about:blank#1' &&",
            "      ads[1].metadata['price'] === 0.02",
            "    )",
            "  ) {",
            "    throw new Error();",
            "  }",
            "  return {",
            "    ad: { 'arbitraryKey': 'arbitrary value' },",
            "    bid: 0.03,",
            "    render: 'about:blank#1',",
            "  };",
            "}",
          ].join("\n"),
        });
      fakeServerHandler
        .withArgs(
          jasmine.objectContaining<FakeRequest>({
            url: new URL(decisionLogicUrl),
          })
        )
        .and.resolveTo({
          headers: {
            "Content-Type": "application/javascript",
            "X-Allow-FLEDGE": "true",
          },
          body: [
            "function scoreAd(",
            "  adMetadata,",
            "  bid,",
            "  { decisionLogicUrl, trustedScoringSignalsUrl }",
            ") {",
            "  if (",
            "    !(",
            "      adMetadata['arbitraryKey'] === 'arbitrary value' &&",
            "      bid === 0.03 &&",
            "      decisionLogicUrl === 'https://ssp.test/scorer.js' &&",
            "      trustedScoringSignalsUrl === undefined",
            "    )",
            "  ) {",
            "    throw new Error();",
            "  }",
            "  return 10;",
            "}",
          ].join("\n"),
        });
      setFakeServerHandler(fakeServerHandler);
      const fledgeShim = create();
      const renderUrl = "about:blank#1";
      fledgeShim.joinAdInterestGroup({
        name,
        biddingLogicUrl,
        ads: [
          { renderUrl: "about:blank#2", metadata: { "price": 0.01 } },
          { renderUrl, metadata: { "price": 0.02 } },
        ],
      });
      const token = await fledgeShim.runAdAuction({ decisionLogicUrl });
      assertToBeTruthy(token);
      expect(await renderUrlFromAuctionResult(token)).toBe(renderUrl);
      expect(fakeServerHandler).toHaveBeenCalledTimes(2);
      expect(fakeServerHandler).toHaveBeenCalledWith(
        jasmine.objectContaining<FakeRequest>({
          url: new URL(biddingLogicUrl),
          method: "GET",
          headers: jasmine.objectContaining<{ [name: string]: string }>({
            "accept": "application/javascript",
          }),
          body: Uint8Array.of(),
          hasCredentials: false,
        })
      );
      expect(fakeServerHandler).toHaveBeenCalledWith(
        jasmine.objectContaining<FakeRequest>({
          url: new URL(decisionLogicUrl),
          method: "GET",
          headers: jasmine.objectContaining<{ [name: string]: string }>({
            "accept": "application/javascript",
          }),
          body: Uint8Array.of(),
          hasCredentials: false,
        })
      );
    });

    it("should return the higher-scoring ad across multiple interest groups", async () => {
      const fakeServerHandler =
        jasmine.createSpy<FakeServerHandler>("fakeServerHandler");
      fakeServerHandler
        .withArgs(
          jasmine.objectContaining<FakeRequest>({
            url: new URL("https://dsp-1.test/bidder.js"),
          })
        )
        .and.resolveTo({
          headers: {
            "Content-Type": "application/javascript",
            "X-Allow-FLEDGE": "true",
          },
          body: [
            "function generateBid({",
            "  name,",
            "  biddingLogicUrl,",
            "  trustedBiddingSignalsUrl,",
            "  ads,",
            "}) {",
            "  if (",
            "    !(",
            "      name === 'interest group 1' &&",
            "      biddingLogicUrl === 'https://dsp-1.test/bidder.js' &&",
            "      trustedBiddingSignalsUrl === undefined &&",
            "      ads.length === 1 &&",
            "      ads[0].renderUrl === 'about:blank#1' &&",
            "      ads[0].metadata['price'] === 0.01",
            "    )",
            "  ) {",
            "    throw new Error();",
            "  }",
            "  return {",
            "    ad: { 'arbitraryKey': 'arbitrary value 1' },",
            "    bid: 0.03,",
            "    render: 'about:blank#1',",
            "  };",
            "}",
          ].join("\n"),
        });
      fakeServerHandler
        .withArgs(
          jasmine.objectContaining<FakeRequest>({
            url: new URL("https://dsp-2.test/bidder.js"),
          })
        )
        .and.resolveTo({
          headers: {
            "Content-Type": "application/javascript",
            "X-Allow-FLEDGE": "true",
          },
          body: [
            "function generateBid({",
            "  name,",
            "  biddingLogicUrl,",
            "  trustedBiddingSignalsUrl,",
            "  ads,",
            "}) {",
            "  if (",
            "    !(",
            "      name === 'interest group 2' &&",
            "      biddingLogicUrl === 'https://dsp-2.test/bidder.js' &&",
            "      trustedBiddingSignalsUrl === undefined &&",
            "      ads.length === 1 &&",
            "      ads[0].renderUrl === 'about:blank#2' &&",
            "      ads[0].metadata['price'] === 0.02",
            "    )",
            "  ) {",
            "    throw new Error();",
            "  }",
            "  return {",
            "    ad: { 'arbitraryKey': 'arbitrary value 2' },",
            "    bid: 0.04,",
            "    render: 'about:blank#2',",
            "  };",
            "}",
          ].join("\n"),
        });
      fakeServerHandler
        .withArgs(
          jasmine.objectContaining<FakeRequest>({
            url: new URL(decisionLogicUrl),
          })
        )
        .and.resolveTo({
          headers: {
            "Content-Type": "application/javascript",
            "X-Allow-FLEDGE": "true",
          },
          body: [
            "function scoreAd(",
            "  adMetadata,",
            "  bid,",
            "  { decisionLogicUrl, trustedScoringSignalsUrl }",
            ") {",
            "  if (",
            "    !(",
            "      decisionLogicUrl === 'https://ssp.test/scorer.js' &&",
            "      trustedScoringSignalsUrl === undefined",
            "    )",
            "  ) {",
            "    throw new Error();",
            "  }",
            "  const arbitraryKey = adMetadata['arbitraryKey'];",
            "  if (arbitraryKey === 'arbitrary value 1' && bid === 0.03) {",
            "    return 10;",
            "  }",
            "  if (arbitraryKey === 'arbitrary value 2' && bid === 0.04) {",
            "    return 20;",
            "  }",
            "  throw new Error();",
            "}",
          ].join("\n"),
        });
      setFakeServerHandler(fakeServerHandler);
      const fledgeShim = create();
      fledgeShim.joinAdInterestGroup({
        name: "interest group 1",
        biddingLogicUrl: "https://dsp-1.test/bidder.js",
        ads: [{ renderUrl: "about:blank#1", metadata: { "price": 0.01 } }],
      });
      fledgeShim.joinAdInterestGroup({
        name: "interest group 2",
        biddingLogicUrl: "https://dsp-2.test/bidder.js",
        ads: [{ renderUrl: "about:blank#2", metadata: { "price": 0.02 } }],
      });
      const token = await fledgeShim.runAdAuction({ decisionLogicUrl });
      assertToBeTruthy(token);
      expect(await renderUrlFromAuctionResult(token)).toBe("about:blank#2");
      expect(fakeServerHandler).toHaveBeenCalledTimes(3);
      expect(fakeServerHandler).toHaveBeenCalledWith(
        jasmine.objectContaining<FakeRequest>({
          url: new URL("https://dsp-1.test/bidder.js"),
          method: "GET",
          headers: jasmine.objectContaining<{ [name: string]: string }>({
            "accept": "application/javascript",
          }),
          body: Uint8Array.of(),
          hasCredentials: false,
        })
      );
      expect(fakeServerHandler).toHaveBeenCalledWith(
        jasmine.objectContaining<FakeRequest>({
          url: new URL("https://dsp-2.test/bidder.js"),
          method: "GET",
          headers: jasmine.objectContaining<{ [name: string]: string }>({
            "accept": "application/javascript",
          }),
          body: Uint8Array.of(),
          hasCredentials: false,
        })
      );
      expect(fakeServerHandler).toHaveBeenCalledWith(
        jasmine.objectContaining<FakeRequest>({
          url: new URL(decisionLogicUrl),
          method: "GET",
          headers: jasmine.objectContaining<{ [name: string]: string }>({
            "accept": "application/javascript",
          }),
          body: Uint8Array.of(),
          hasCredentials: false,
        })
      );
    });

    const trustedBiddingSignalsUrl = "https://trusted-server.test/bidding";
    const trustedScoringSignalsUrl = "https://trusted-server.test/scoring";

    it("should fetch trusted bidding and scoring signals", async () => {
      const fakeServerHandler =
        jasmine.createSpy<FakeServerHandler>("fakeServerHandler");
      fakeServerHandler
        .withArgs(
          jasmine.objectContaining<FakeRequest>({
            url: new URL(biddingLogicUrl),
          })
        )
        .and.resolveTo({
          headers: {
            "Content-Type": "application/javascript",
            "X-Allow-FLEDGE": "true",
          },
          body: [
            "function generateBid() {",
            "  return { ad: null, bid: 0.03, render: 'about:blank' };",
            "}",
          ].join("\n"),
        });
      fakeServerHandler
        .withArgs(
          jasmine.objectContaining<FakeRequest>({
            url: new URL(decisionLogicUrl),
          })
        )
        .and.resolveTo({
          headers: {
            "Content-Type": "application/javascript",
            "X-Allow-FLEDGE": "true",
          },
          body: "function scoreAd() { return 20; }",
        });
      fakeServerHandler
        .withArgs(
          jasmine.objectContaining<FakeRequest>({
            url: new URL(
              trustedBiddingSignalsUrl +
                `?hostname=${encodeURIComponent(location.hostname)}`
            ),
          })
        )
        .and.resolveTo({
          headers: {
            "Content-Type": "application/json",
            "X-Allow-FLEDGE": "true",
          },
          body: '{"a": 1, "b": [true, null]}',
        });
      fakeServerHandler
        .withArgs(
          jasmine.objectContaining<FakeRequest>({
            url: new URL(trustedScoringSignalsUrl + "?keys=about%3Ablank"),
          })
        )
        .and.resolveTo({
          headers: {
            "Content-Type": "application/json",
            "X-Allow-FLEDGE": "true",
          },
          body: '{"a": 1, "b": [true, null]}',
        });
      setFakeServerHandler(fakeServerHandler);
      const fledgeShim = create();
      fledgeShim.joinAdInterestGroup({
        name: "interest group 1",
        biddingLogicUrl,
        trustedBiddingSignalsUrl,
        ads: [{ renderUrl: "about:blank", metadata: { "price": 0.02 } }],
      });
      await fledgeShim.runAdAuction({
        decisionLogicUrl,
        trustedScoringSignalsUrl,
      });
      expect(fakeServerHandler).toHaveBeenCalledTimes(4);
      expect(fakeServerHandler).toHaveBeenCalledWith(
        jasmine.objectContaining<FakeRequest>({
          url: new URL(biddingLogicUrl),
        })
      );
      expect(fakeServerHandler).toHaveBeenCalledWith(
        jasmine.objectContaining<FakeRequest>({
          url: new URL(decisionLogicUrl),
        })
      );
      expect(fakeServerHandler).toHaveBeenCalledWith(
        jasmine.objectContaining<FakeRequest>({
          url: new URL(
            trustedBiddingSignalsUrl +
              `?hostname=${encodeURIComponent(location.hostname)}`
          ),
          method: "GET",
          headers: jasmine.objectContaining<{ [name: string]: string }>({
            "accept": "application/json",
          }),
          body: Uint8Array.of(),
          hasCredentials: false,
        })
      );
      expect(fakeServerHandler).toHaveBeenCalledWith(
        jasmine.objectContaining<FakeRequest>({
          url: new URL(trustedScoringSignalsUrl + "?keys=about%3Ablank"),
          method: "GET",
          headers: jasmine.objectContaining<{ [name: string]: string }>({
            "accept": "application/json",
          }),
          body: Uint8Array.of(),
          hasCredentials: false,
        })
      );
    });

    it("should not fetch trusted scoring signals if there are no ads", async () => {
      const fakeServerHandler =
        jasmine.createSpy<FakeServerHandler>("fakeServerHandler");
      setFakeServerHandler(fakeServerHandler);
      await create().runAdAuction({
        decisionLogicUrl,
        trustedScoringSignalsUrl,
      });
      expect(fakeServerHandler).not.toHaveBeenCalled();
    });

    it("should reject on an ill-formed URL", () =>
      expectAsync(
        create().runAdAuction({
          decisionLogicUrl,
          trustedScoringSignalsUrl: "This string is not a URL.",
        })
      ).toBeRejectedWithError(/.*This string is not a URL\..*/));

    it("should reject on a non-HTTPS URL", () =>
      expectAsync(
        create().runAdAuction({
          decisionLogicUrl,
          trustedScoringSignalsUrl: "http://insecure-server.test/scoring",
        })
      ).toBeRejectedWithError(/.*http:\/\/insecure-server\.test\/scoring.*/));

    it("should reject on a URL with a query string", () =>
      expectAsync(
        create().runAdAuction({
          decisionLogicUrl,
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
        ads: [{ renderUrl, metadata: { "price": 0.02 } }],
      });
      fledgeShim.joinAdInterestGroup({
        name,
        ads: [],
      });
      expect(await fledgeShim.runAdAuction({ decisionLogicUrl })).toBeNull();
    });

    it("should not overwrite old property values with undefined ones", async () => {
      const fakeServerHandler =
        jasmine.createSpy<FakeServerHandler>("fakeServerHandler");
      fakeServerHandler
        .withArgs(
          jasmine.objectContaining<FakeRequest>({
            url: new URL(biddingLogicUrl),
          })
        )
        .and.resolveTo({
          headers: {
            "Content-Type": "application/javascript",
            "X-Allow-FLEDGE": "true",
          },
          body: [
            "function generateBid() {",
            "  return { ad: null, bid: 0.03, render: 'about:blank' };",
            "}",
          ].join("\n"),
        });
      fakeServerHandler
        .withArgs(
          jasmine.objectContaining<FakeRequest>({
            url: new URL(decisionLogicUrl),
          })
        )
        .and.resolveTo({
          headers: {
            "Content-Type": "application/javascript",
            "X-Allow-FLEDGE": "true",
          },
          body: "function scoreAd() { return 20; }",
        });
      setFakeServerHandler(fakeServerHandler);
      const fledgeShim = create();
      const renderUrl = "about:blank";
      fledgeShim.joinAdInterestGroup({
        name,
        biddingLogicUrl,
        ads: [{ renderUrl, metadata: { "price": 0.02 } }],
      });
      fledgeShim.joinAdInterestGroup({
        name,
        ads: undefined,
      });
      const token = await fledgeShim.runAdAuction({ decisionLogicUrl });
      assertToBeTruthy(token);
      expect(await renderUrlFromAuctionResult(token)).toBe(renderUrl);
    });
  });

  describe("leaveAdInterestGroup", () => {
    it("should prevent ads from appearing in the auction", async () => {
      const fledgeShim = create();
      fledgeShim.joinAdInterestGroup({
        name,
        ads: [{ renderUrl: "about:blank", metadata: { "price": 0.02 } }],
      });
      fledgeShim.leaveAdInterestGroup({ name });
      expect(await fledgeShim.runAdAuction({ decisionLogicUrl })).toBeNull();
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
      await expectAsync(
        fledgeShim.runAdAuction({ decisionLogicUrl })
      ).toBeRejectedWithError();
    });
  });
});
