/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import "jasmine";
import { assertToBeString } from "../testing/assert";
import {
  FakeRequest,
  FakeServerHandler,
  setFakeServerHandler,
} from "../testing/http";
import { clearStorageBeforeAndAfter } from "../testing/storage";
import { runAdAuction } from "./auction";
import { storeInterestGroup } from "./db_schema";

describe("runAdAuction", () => {
  clearStorageBeforeAndAfter();

  const name = "interest group name";
  const biddingLogicUrl1 = "https://dsp-1.test/bidder.js";
  const biddingLogicUrl2 = "https://dsp-2.test/bidder.js";
  const biddingLogicUrl3 = "https://dsp-3.test/bidder.js";
  const biddingLogicUrl4 = "https://dsp-4.test/bidder.js";
  const decisionLogicUrl = "https://ssp.test/scorer.js";
  const javaScriptHeaders = {
    "Content-Type": "application/javascript",
    "X-Allow-FLEDGE": "true",
  };
  const ad1 = { renderUrl: "about:blank#1", metadata: { "price": 0.01 } };
  const ad2 = { renderUrl: "about:blank#2", metadata: { "price": 0.02 } };
  const ad3 = { renderUrl: "about:blank#3", metadata: { "price": 0.03 } };
  const ad4 = { renderUrl: "about:blank#4", metadata: { "price": 0.04 } };
  const hostname = "www.example.com";
  const allowedLogicUrlPrefixes = [
    "https://dsp-1.test/",
    "https://dsp-2.test/",
    "https://dsp-3.test/",
    "https://dsp-4.test/",
    "https://ssp.test/",
  ];

  it("should return an ad from a single interest group", async () => {
    const fakeServerHandler =
      jasmine.createSpy<FakeServerHandler>("fakeServerHandler");
    fakeServerHandler
      .withArgs(
        jasmine.objectContaining<FakeRequest>({
          url: new URL(biddingLogicUrl1),
        })
      )
      .and.resolveTo({
        headers: javaScriptHeaders,
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
          "      biddingLogicUrl === 'https://dsp-1.test/bidder.js' &&",
          "      trustedBiddingSignalsUrl === undefined &&",
          "      ads.length === 2 &&",
          "      ads[0].renderUrl === 'about:blank#1' &&",
          "      ads[0].metadata['price'] === 0.01 &&",
          "      ads[1].renderUrl === 'about:blank#2' &&",
          "      ads[1].metadata['price'] === 0.02",
          "    )",
          "  ) {",
          "    throw new Error();",
          "  }",
          "  return { ad: 'Metadata', bid: 0.03, render: 'about:blank#2' };",
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
        headers: javaScriptHeaders,
        body: [
          "function scoreAd(",
          "  adMetadata,",
          "  bid,",
          "  { decisionLogicUrl, trustedScoringSignalsUrl },",
          ") {",
          "  if (",
          "    !(",
          "      adMetadata === 'Metadata' &&",
          "      bid === 0.03 &&",
          "      decisionLogicUrl === 'https://ssp.test/scorer.js' &&",
          "      trustedScoringSignalsUrl === undefined",
          "    )",
          "  ) {",
          "    throw new Error();",
          "  }",
          "  return 40;",
          "}",
        ].join("\n"),
      });
    setFakeServerHandler(fakeServerHandler);
    expect(
      await storeInterestGroup({
        name,
        biddingLogicUrl: biddingLogicUrl1,
        ads: [ad1, ad2],
      })
    ).toBeTrue();
    const token = await runAdAuction(
      { decisionLogicUrl },
      hostname,
      allowedLogicUrlPrefixes
    );
    assertToBeString(token);
    expect(sessionStorage.getItem(token)).toBe(ad2.renderUrl);
    expect(fakeServerHandler).toHaveBeenCalledTimes(2);
    expect(fakeServerHandler).toHaveBeenCalledWith({
      url: new URL(biddingLogicUrl1),
      method: "GET",
      headers: jasmine.objectContaining<{ [name: string]: string }>({
        "accept": "application/javascript",
      }),
      body: Uint8Array.of(),
      hasCredentials: false,
    });
    expect(fakeServerHandler).toHaveBeenCalledWith({
      url: new URL(decisionLogicUrl),
      method: "GET",
      headers: jasmine.objectContaining<{ [name: string]: string }>({
        "accept": "application/javascript",
      }),
      body: Uint8Array.of(),
      hasCredentials: false,
    });
  });

  it("should return the higher-scoring ad across multiple interest groups", async () => {
    const fakeServerHandler =
      jasmine.createSpy<FakeServerHandler>("fakeServerHandler");
    fakeServerHandler
      .withArgs(
        jasmine.objectContaining<FakeRequest>({
          url: new URL(biddingLogicUrl1),
        })
      )
      .and.resolveTo({
        headers: javaScriptHeaders,
        body: [
          "function generateBid({",
          "  name,",
          "  biddingLogicUrl,",
          "  trustedBiddingSignalsUrl,",
          "  ads,",
          "}) {",
          "  if (",
          "    !(",
          "      name === 'interest group name 1' &&",
          "      biddingLogicUrl === 'https://dsp-1.test/bidder.js' &&",
          "      trustedBiddingSignalsUrl === undefined &&",
          "      ads.length === 1 &&",
          "      ads[0].renderUrl === 'about:blank#1' &&",
          "      ads[0].metadata['price'] === 0.01",
          "    )",
          "  ) {",
          "    throw new Error();",
          "  }",
          "  return { ad: 1, bid: 0.03, render: 'about:blank#1' };",
          "}",
        ].join("\n"),
      });
    fakeServerHandler
      .withArgs(
        jasmine.objectContaining<FakeRequest>({
          url: new URL(biddingLogicUrl2),
        })
      )
      .and.resolveTo({
        headers: javaScriptHeaders,
        body: [
          "function generateBid({",
          "  name,",
          "  biddingLogicUrl,",
          "  trustedBiddingSignalsUrl,",
          "  ads,",
          "}) {",
          "  if (",
          "    !(",
          "      name === 'interest group name 2' &&",
          "      biddingLogicUrl === 'https://dsp-2.test/bidder.js' &&",
          "      trustedBiddingSignalsUrl === undefined &&",
          "      ads.length === 1 &&",
          "      ads[0].renderUrl === 'about:blank#2' &&",
          "      ads[0].metadata['price'] === 0.02",
          "    )",
          "  ) {",
          "    throw new Error();",
          "  }",
          "  return { ad: 2, bid: 0.04, render: 'about:blank#2' };",
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
        headers: javaScriptHeaders,
        body: [
          "function scoreAd(",
          "  adMetadata,",
          "  bid,",
          "  { decisionLogicUrl, trustedScoringSignalsUrl },",
          ") {",
          "  if (",
          "    !(",
          "      decisionLogicUrl === 'https://ssp.test/scorer.js' &&",
          "      trustedScoringSignalsUrl === undefined",
          "    )",
          "  ) {",
          "    throw new Error();",
          "  }",
          "  if (adMetadata === 1 && bid === 0.03) {",
          "    return 10;",
          "  }",
          "  if (adMetadata === 2 && bid === 0.04) {",
          "    return 20;",
          "  }",
          "  throw new Error();",
          "}",
        ].join("\n"),
      });
    setFakeServerHandler(fakeServerHandler);
    expect(
      await storeInterestGroup({
        name: "interest group name 1",
        biddingLogicUrl: biddingLogicUrl1,
        ads: [ad1],
      })
    ).toBeTrue();
    expect(
      await storeInterestGroup({
        name: "interest group name 2",
        biddingLogicUrl: biddingLogicUrl2,
        ads: [ad2],
      })
    ).toBeTrue();
    const token = await runAdAuction(
      { decisionLogicUrl },
      hostname,
      allowedLogicUrlPrefixes
    );
    assertToBeString(token);
    expect(sessionStorage.getItem(token)).toBe(ad2.renderUrl);
    expect(fakeServerHandler).toHaveBeenCalledTimes(3);
    expect(fakeServerHandler).toHaveBeenCalledWith({
      url: new URL(biddingLogicUrl1),
      method: "GET",
      headers: jasmine.objectContaining<{ [name: string]: string }>({
        "accept": "application/javascript",
      }),
      body: Uint8Array.of(),
      hasCredentials: false,
    });
    expect(fakeServerHandler).toHaveBeenCalledWith({
      url: new URL(biddingLogicUrl2),
      method: "GET",
      headers: jasmine.objectContaining<{ [name: string]: string }>({
        "accept": "application/javascript",
      }),
      body: Uint8Array.of(),
      hasCredentials: false,
    });
    expect(fakeServerHandler).toHaveBeenCalledWith({
      url: new URL(decisionLogicUrl),
      method: "GET",
      headers: jasmine.objectContaining<{ [name: string]: string }>({
        "accept": "application/javascript",
      }),
      body: Uint8Array.of(),
      hasCredentials: false,
    });
  });

  it("should return true if there are no ads", async () => {
    const result = await runAdAuction(
      { decisionLogicUrl },
      hostname,
      allowedLogicUrlPrefixes
    );
    expect(result).toBeTrue();
    expect(sessionStorage.length).toBe(0);
  });

  it("should return tokens in the expected format", async () => {
    const fakeServerHandler =
      jasmine.createSpy<FakeServerHandler>("fakeServerHandler");
    fakeServerHandler
      .withArgs(
        jasmine.objectContaining<FakeRequest>({
          url: new URL(biddingLogicUrl1),
        })
      )
      .and.resolveTo({
        headers: javaScriptHeaders,
        body: [
          "function generateBid() {",
          "  return { ad: null, bid: 0.03, render: 'about:blank#1' };",
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
        headers: javaScriptHeaders,
        body: "function scoreAd() { return 10; }",
      });
    setFakeServerHandler(fakeServerHandler);
    expect(
      await storeInterestGroup({
        name,
        biddingLogicUrl: biddingLogicUrl1,
        ads: [ad1],
      })
    ).toBeTrue();
    for (let i = 0; i < 100; i++) {
      expect(
        await runAdAuction(
          { decisionLogicUrl },
          hostname,
          allowedLogicUrlPrefixes
        )
      ).toMatch(/^[0-9a-f]{32}$/);
    }
  });

  it("should drop scores that are zero", async () => {
    const fakeServerHandler =
      jasmine.createSpy<FakeServerHandler>("fakeServerHandler");
    fakeServerHandler
      .withArgs(
        jasmine.objectContaining<FakeRequest>({
          url: new URL(biddingLogicUrl1),
        })
      )
      .and.resolveTo({
        headers: javaScriptHeaders,
        body: [
          "function generateBid() {",
          "  return { ad: null, bid: 0.03, render: 'about:blank#1' };",
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
        headers: javaScriptHeaders,
        body: "function scoreAd() { return 0; }",
      });
    setFakeServerHandler(fakeServerHandler);
    expect(
      await storeInterestGroup({
        name,
        biddingLogicUrl: biddingLogicUrl1,
        ads: [ad1],
      })
    ).toBeTrue();
    expect(
      await runAdAuction(
        { decisionLogicUrl },
        hostname,
        allowedLogicUrlPrefixes
      )
    ).toBeTrue();
  });

  it("should drop scores that are negative", async () => {
    const fakeServerHandler =
      jasmine.createSpy<FakeServerHandler>("fakeServerHandler");
    fakeServerHandler
      .withArgs(
        jasmine.objectContaining<FakeRequest>({
          url: new URL(biddingLogicUrl1),
        })
      )
      .and.resolveTo({
        headers: javaScriptHeaders,
        body: [
          "function generateBid() {",
          "  return { ad: null, bid: 0.03, render: 'about:blank#1' };",
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
        headers: javaScriptHeaders,
        body: "function scoreAd() { return -20; }",
      });
    setFakeServerHandler(fakeServerHandler);
    expect(
      await storeInterestGroup({
        name,
        biddingLogicUrl: biddingLogicUrl1,
        ads: [ad1],
      })
    ).toBeTrue();
    expect(
      await runAdAuction(
        { decisionLogicUrl },
        hostname,
        allowedLogicUrlPrefixes
      )
    ).toBeTrue();
  });

  it("should drop scores that are infinite", async () => {
    const fakeServerHandler =
      jasmine.createSpy<FakeServerHandler>("fakeServerHandler");
    fakeServerHandler
      .withArgs(
        jasmine.objectContaining<FakeRequest>({
          url: new URL(biddingLogicUrl1),
        })
      )
      .and.resolveTo({
        headers: javaScriptHeaders,
        body: [
          "function generateBid() {",
          "  return { ad: null, bid: 0.03, render: 'about:blank#1' };",
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
        headers: javaScriptHeaders,
        body: "function scoreAd() { return Infinity; }",
      });
    setFakeServerHandler(fakeServerHandler);
    expect(
      await storeInterestGroup({
        name,
        biddingLogicUrl: biddingLogicUrl1,
        ads: [ad1],
      })
    ).toBeTrue();
    expect(
      await runAdAuction(
        { decisionLogicUrl },
        hostname,
        allowedLogicUrlPrefixes
      )
    ).toBeTrue();
  });

  it("should drop scores that are NaN", async () => {
    const fakeServerHandler =
      jasmine.createSpy<FakeServerHandler>("fakeServerHandler");
    fakeServerHandler
      .withArgs(
        jasmine.objectContaining<FakeRequest>({
          url: new URL(biddingLogicUrl1),
        })
      )
      .and.resolveTo({
        headers: javaScriptHeaders,
        body: [
          "function generateBid() {",
          "  return { ad: null, bid: 0.03, render: 'about:blank#1' };",
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
        headers: javaScriptHeaders,
        body: "function scoreAd() { return NaN; }",
      });
    setFakeServerHandler(fakeServerHandler);
    expect(
      await storeInterestGroup({
        name,
        biddingLogicUrl: biddingLogicUrl1,
        ads: [ad1],
      })
    ).toBeTrue();
    expect(
      await runAdAuction(
        { decisionLogicUrl },
        hostname,
        allowedLogicUrlPrefixes
      )
    ).toBeTrue();
  });

  it("should drop bids on network error for bidding script", async () => {
    const fakeServerHandler =
      jasmine.createSpy<FakeServerHandler>("fakeServerHandler");
    fakeServerHandler
      .withArgs(
        jasmine.objectContaining<FakeRequest>({
          url: new URL(biddingLogicUrl1),
        })
      )
      .and.resolveTo(null);
    fakeServerHandler
      .withArgs(
        jasmine.objectContaining<FakeRequest>({
          url: new URL(decisionLogicUrl),
        })
      )
      .and.resolveTo({
        headers: javaScriptHeaders,
        body: "function scoreAd() { return 10; }",
      });
    setFakeServerHandler(fakeServerHandler);
    expect(
      await storeInterestGroup({
        name,
        biddingLogicUrl: biddingLogicUrl1,
        ads: [ad1],
      })
    ).toBeTrue();
    expect(
      await runAdAuction(
        { decisionLogicUrl },
        hostname,
        allowedLogicUrlPrefixes
      )
    ).toBeTrue();
  });

  it("should return true on network error for scoring script", async () => {
    const fakeServerHandler =
      jasmine.createSpy<FakeServerHandler>("fakeServerHandler");
    fakeServerHandler
      .withArgs(
        jasmine.objectContaining<FakeRequest>({
          url: new URL(biddingLogicUrl1),
        })
      )
      .and.resolveTo({
        headers: javaScriptHeaders,
        body: [
          "function generateBid() {",
          "  return { ad: null, bid: 0.03, render: 'about:blank#1' };",
          "}",
        ].join("\n"),
      });
    fakeServerHandler
      .withArgs(
        jasmine.objectContaining<FakeRequest>({
          url: new URL(decisionLogicUrl),
        })
      )
      .and.resolveTo(null);
    setFakeServerHandler(fakeServerHandler);
    expect(
      await storeInterestGroup({
        name,
        biddingLogicUrl: biddingLogicUrl1,
        ads: [ad1],
      })
    ).toBeTrue();
    expect(
      await runAdAuction(
        { decisionLogicUrl },
        hostname,
        allowedLogicUrlPrefixes
      )
    ).toBeTrue();
  });

  it("should drop bids on bidding worklet error", async () => {
    const fakeServerHandler =
      jasmine.createSpy<FakeServerHandler>("fakeServerHandler");
    fakeServerHandler
      .withArgs(
        jasmine.objectContaining<FakeRequest>({
          url: new URL(biddingLogicUrl1),
        })
      )
      .and.resolveTo({
        headers: javaScriptHeaders,
        body: "throw new Error();",
      });
    fakeServerHandler
      .withArgs(
        jasmine.objectContaining<FakeRequest>({
          url: new URL(decisionLogicUrl),
        })
      )
      .and.resolveTo({
        headers: javaScriptHeaders,
        body: "function scoreAd() { return 10; }",
      });
    setFakeServerHandler(fakeServerHandler);
    expect(
      await storeInterestGroup({
        name,
        biddingLogicUrl: biddingLogicUrl1,
        ads: [ad1],
      })
    ).toBeTrue();
    expect(
      await runAdAuction(
        { decisionLogicUrl },
        hostname,
        allowedLogicUrlPrefixes,
        "console.warn = () => {};"
      )
    ).toBeTrue();
  });

  it("should log a warning and drop bids for ads not in the interest group", async () => {
    const fakeServerHandler =
      jasmine.createSpy<FakeServerHandler>("fakeServerHandler");
    fakeServerHandler
      .withArgs(
        jasmine.objectContaining<FakeRequest>({
          url: new URL(biddingLogicUrl1),
        })
      )
      .and.resolveTo({
        headers: javaScriptHeaders,
        body: [
          "function generateBid() {",
          "  return {",
          "    ad: null,",
          "    bid: 0.02,",
          "    render: 'https://advertiser.test/nope',",
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
        headers: javaScriptHeaders,
        body: "function scoreAd() { return 10; }",
      });
    setFakeServerHandler(fakeServerHandler);
    const consoleSpy = spyOnAllFunctions(console);
    const group = {
      name,
      biddingLogicUrl: biddingLogicUrl1,
      trustedBiddingSignalsUrl: undefined,
      ads: [ad1],
    };
    expect(await storeInterestGroup(group)).toBeTrue();
    expect(
      await runAdAuction(
        { decisionLogicUrl },
        hostname,
        allowedLogicUrlPrefixes
      )
    ).toBeTrue();
    expect(consoleSpy.warn).toHaveBeenCalledOnceWith(
      jasmine.any(String),
      "https://advertiser.test/nope",
      jasmine.any(String),
      group
    );
  });

  it("should log a warning and drop bids if bidding logic URL is not allowlisted", async () => {
    const fakeServerHandler =
      jasmine.createSpy<FakeServerHandler>("fakeServerHandler");
    setFakeServerHandler(fakeServerHandler);
    const consoleSpy = spyOnAllFunctions(console);
    expect(
      await storeInterestGroup({
        name,
        biddingLogicUrl: "https://untrusted.test/bidder.js",
        ads: [ad1],
      })
    ).toBeTrue();
    expect(
      await runAdAuction(
        { decisionLogicUrl },
        hostname,
        allowedLogicUrlPrefixes
      )
    ).toBeTrue();
    expect(fakeServerHandler).not.toHaveBeenCalled();
    expect(consoleSpy.warn).toHaveBeenCalledOnceWith(
      jasmine.any(String),
      "https://untrusted.test/bidder.js"
    );
  });

  it("should log an error and return false if decision logic URL is not allowlisted", async () => {
    const fakeServerHandler =
      jasmine.createSpy<FakeServerHandler>("fakeServerHandler");
    setFakeServerHandler(fakeServerHandler);
    const consoleSpy = spyOnAllFunctions(console);
    expect(
      await storeInterestGroup({
        name,
        biddingLogicUrl: biddingLogicUrl1,
        ads: [ad1],
      })
    ).toBeTrue();
    expect(
      await runAdAuction(
        { decisionLogicUrl: "https://untrusted.test/scorer.js" },
        hostname,
        allowedLogicUrlPrefixes
      )
    ).toBeFalse();
    expect(fakeServerHandler).not.toHaveBeenCalled();
    expect(consoleSpy.error).toHaveBeenCalledOnceWith(
      jasmine.any(String),
      "https://untrusted.test/scorer.js"
    );
  });

  it("should log a warning and drop bids on missing header for bidding script", async () => {
    const fakeServerHandler =
      jasmine.createSpy<FakeServerHandler>("fakeServerHandler");
    fakeServerHandler
      .withArgs(
        jasmine.objectContaining<FakeRequest>({
          url: new URL(biddingLogicUrl1),
        })
      )
      .and.resolveTo({
        headers: { "Content-Type": "application/javascript" },
        body: [
          "function generateBid() {",
          "  return { ad: null, bid: 0.03, render: 'about:blank#1' };",
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
        headers: javaScriptHeaders,
        body: "function scoreAd() { return 10; }",
      });
    setFakeServerHandler(fakeServerHandler);
    const consoleSpy = spyOnAllFunctions(console);
    expect(
      await storeInterestGroup({
        name,
        biddingLogicUrl: biddingLogicUrl1,
        ads: [ad1],
      })
    ).toBeTrue();
    expect(
      await runAdAuction(
        { decisionLogicUrl },
        hostname,
        allowedLogicUrlPrefixes
      )
    ).toBeTrue();
    expect(consoleSpy.warn).toHaveBeenCalledOnceWith(
      jasmine.any(String),
      biddingLogicUrl1,
      jasmine.any(String)
    );
  });

  it("should log an error and return true on missing header for scoring script", async () => {
    const fakeServerHandler =
      jasmine.createSpy<FakeServerHandler>("fakeServerHandler");
    fakeServerHandler
      .withArgs(
        jasmine.objectContaining<FakeRequest>({
          url: new URL(biddingLogicUrl1),
        })
      )
      .and.resolveTo({
        headers: javaScriptHeaders,
        body: [
          "function generateBid() {",
          "  return { ad: null, bid: 0.03, render: 'about:blank#1' };",
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
        headers: { "Content-Type": "application/javascript" },
        body: "function scoreAd() { return 10; }",
      });
    setFakeServerHandler(fakeServerHandler);
    const consoleSpy = spyOnAllFunctions(console);
    expect(
      await storeInterestGroup({
        name,
        biddingLogicUrl: biddingLogicUrl1,
        ads: [ad1],
      })
    ).toBeTrue();
    expect(
      await runAdAuction(
        { decisionLogicUrl },
        hostname,
        allowedLogicUrlPrefixes
      )
    ).toBeTrue();
    expect(consoleSpy.error).toHaveBeenCalledOnceWith(
      jasmine.any(String),
      decisionLogicUrl,
      jasmine.any(String)
    );
  });

  const trustedBiddingSignalsUrl = "https://trusted-server.test/bidding";
  const trustedScoringSignalsUrl = "https://trusted-server.test/scoring";
  const jsonHeaders = {
    "Content-Type": "application/json",
    "X-Allow-FLEDGE": "true",
  };
  const trustedSignalsResponse = {
    headers: jsonHeaders,
    body: '{"a": 1, "b": [true, null]}',
  };

  it("should fetch trusted bidding and scoring signals for ads in a single interest group", async () => {
    const fakeServerHandler =
      jasmine.createSpy<FakeServerHandler>("fakeServerHandler");
    fakeServerHandler
      .withArgs(
        jasmine.objectContaining<FakeRequest>({
          url: new URL(biddingLogicUrl1),
        })
      )
      .and.resolveTo({
        headers: javaScriptHeaders,
        body: [
          "function generateBid() {",
          "  return { ad: null, bid: 0.03, render: 'about:blank#2' };",
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
        headers: javaScriptHeaders,
        body: "function scoreAd() { return 10; }",
      });
    fakeServerHandler
      .withArgs(
        jasmine.objectContaining<FakeRequest>({
          url: new URL(trustedBiddingSignalsUrl + "?hostname=www.example.com"),
        })
      )
      .and.resolveTo(trustedSignalsResponse);
    fakeServerHandler
      .withArgs(
        jasmine.objectContaining<FakeRequest>({
          url: new URL(trustedScoringSignalsUrl + "?keys=about%3Ablank%232"),
        })
      )
      .and.resolveTo(trustedSignalsResponse);
    setFakeServerHandler(fakeServerHandler);
    expect(
      await storeInterestGroup({
        name,
        biddingLogicUrl: biddingLogicUrl1,
        trustedBiddingSignalsUrl,
        ads: [ad1, ad2],
      })
    ).toBeTrue();
    expect(
      await runAdAuction(
        { decisionLogicUrl, trustedScoringSignalsUrl },
        hostname,
        allowedLogicUrlPrefixes
      )
    ).toBeTruthy();
    expect(fakeServerHandler).toHaveBeenCalledTimes(4);
    expect(fakeServerHandler).toHaveBeenCalledWith(
      jasmine.objectContaining<FakeRequest>({
        url: new URL(biddingLogicUrl1),
      })
    );
    expect(fakeServerHandler).toHaveBeenCalledWith(
      jasmine.objectContaining<FakeRequest>({
        url: new URL(decisionLogicUrl),
      })
    );
    expect(fakeServerHandler).toHaveBeenCalledWith(
      jasmine.objectContaining<FakeRequest>({
        url: new URL(trustedBiddingSignalsUrl + "?hostname=www.example.com"),
        headers: jasmine.objectContaining<{ [name: string]: string }>({
          "accept": "application/json",
        }),
        hasCredentials: false,
      })
    );
    expect(fakeServerHandler).toHaveBeenCalledWith(
      jasmine.objectContaining<FakeRequest>({
        url: new URL(trustedScoringSignalsUrl + "?keys=about%3Ablank%232"),
        headers: jasmine.objectContaining<{ [name: string]: string }>({
          "accept": "application/json",
        }),
        hasCredentials: false,
      })
    );
  });

  it("should fetch trusted bidding and scoring signals for ads across multiple interest groups", async () => {
    const fakeServerHandler =
      jasmine.createSpy<FakeServerHandler>("fakeServerHandler");
    fakeServerHandler
      .withArgs(
        jasmine.objectContaining<FakeRequest>({
          url: new URL(biddingLogicUrl1),
        })
      )
      .and.resolveTo({
        headers: javaScriptHeaders,
        body: [
          "function generateBid() {",
          "  return { ad: null, bid: 0.03, render: 'about:blank#1' };",
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
        headers: javaScriptHeaders,
        body: "function scoreAd() { return 10; }",
      });
    fakeServerHandler
      .withArgs(
        jasmine.objectContaining<FakeRequest>({
          url: new URL(biddingLogicUrl2),
        })
      )
      .and.resolveTo({
        headers: javaScriptHeaders,
        body: [
          "function generateBid() {",
          "  return { ad: null, bid: 0.05, render: 'about:blank#2' };",
          "}",
        ].join("\n"),
      });
    fakeServerHandler
      .withArgs(
        jasmine.objectContaining<FakeRequest>({
          url: new URL(biddingLogicUrl3),
        })
      )
      .and.resolveTo({
        headers: javaScriptHeaders,
        body: [
          "function generateBid() {",
          "  return { ad: null, bid: 0.04, render: 'about:blank#4' };",
          "}",
        ].join("\n"),
      });
    fakeServerHandler
      .withArgs(
        jasmine.objectContaining<FakeRequest>({
          url: new URL(
            "https://trusted-server-1.test/bidding?hostname=www.example.com"
          ),
        })
      )
      .and.resolveTo(trustedSignalsResponse);
    fakeServerHandler
      .withArgs(
        jasmine.objectContaining<FakeRequest>({
          url: new URL(
            "https://trusted-server-2.test/bidding?hostname=www.example.com"
          ),
        })
      )
      .and.resolveTo(trustedSignalsResponse);
    fakeServerHandler
      .withArgs(
        jasmine.objectContaining<FakeRequest>({
          url: new URL(
            trustedScoringSignalsUrl +
              "?keys=about%3Ablank%231,about%3Ablank%232,about%3Ablank%234"
          ),
        })
      )
      .and.resolveTo(trustedSignalsResponse);
    setFakeServerHandler(fakeServerHandler);
    expect(
      await storeInterestGroup({
        name: "interest group 1",
        biddingLogicUrl: biddingLogicUrl1,
        trustedBiddingSignalsUrl: "https://trusted-server-1.test/bidding",
        ads: [ad1],
      })
    ).toBeTrue();
    expect(
      await storeInterestGroup({
        name: "interest group 2",
        biddingLogicUrl: biddingLogicUrl2,
        trustedBiddingSignalsUrl: "https://trusted-server-2.test/bidding",
        ads: [ad2, ad3],
      })
    ).toBeTrue();
    expect(
      await storeInterestGroup({
        name: "interest group 3",
        biddingLogicUrl: biddingLogicUrl3,
        ads: [ad4],
      })
    ).toBeTrue();
    expect(
      await storeInterestGroup({
        name: "interest group 4",
        biddingLogicUrl: biddingLogicUrl4,
        trustedBiddingSignalsUrl: "https://trusted-server-3.test/bidding",
        ads: [],
      })
    ).toBeTrue();
    setFakeServerHandler(fakeServerHandler);
    expect(
      await runAdAuction(
        { decisionLogicUrl, trustedScoringSignalsUrl },
        hostname,
        allowedLogicUrlPrefixes
      )
    ).toBeTruthy();
    expect(fakeServerHandler).toHaveBeenCalledTimes(7);
    expect(fakeServerHandler).toHaveBeenCalledWith(
      jasmine.objectContaining<FakeRequest>({
        url: new URL(biddingLogicUrl1),
      })
    );
    expect(fakeServerHandler).toHaveBeenCalledWith(
      jasmine.objectContaining<FakeRequest>({
        url: new URL(biddingLogicUrl2),
      })
    );
    expect(fakeServerHandler).toHaveBeenCalledWith(
      jasmine.objectContaining<FakeRequest>({
        url: new URL(biddingLogicUrl3),
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
          "https://trusted-server-1.test/bidding?hostname=www.example.com"
        ),
        headers: jasmine.objectContaining<{ [name: string]: string }>({
          "accept": "application/json",
        }),
        hasCredentials: false,
      })
    );
    expect(fakeServerHandler).toHaveBeenCalledWith(
      jasmine.objectContaining<FakeRequest>({
        url: new URL(
          "https://trusted-server-2.test/bidding?hostname=www.example.com"
        ),
        headers: jasmine.objectContaining<{ [name: string]: string }>({
          "accept": "application/json",
        }),
        hasCredentials: false,
      })
    );
    expect(fakeServerHandler).toHaveBeenCalledWith(
      jasmine.objectContaining<FakeRequest>({
        url: new URL(
          trustedScoringSignalsUrl +
            "?keys=about%3Ablank%231,about%3Ablank%232,about%3Ablank%234"
        ),
        headers: jasmine.objectContaining<{ [name: string]: string }>({
          "accept": "application/json",
        }),
        hasCredentials: false,
      })
    );
  });

  it("should not fetch anything if there are no interest groups", async () => {
    const fakeServerHandler =
      jasmine.createSpy<FakeServerHandler>("fakeServerHandler");
    setFakeServerHandler(fakeServerHandler);
    expect(
      await runAdAuction(
        { decisionLogicUrl, trustedScoringSignalsUrl },
        hostname,
        allowedLogicUrlPrefixes
      )
    ).toBeTruthy();
    expect(fakeServerHandler).not.toHaveBeenCalled();
  });

  it("should not fetch anything if there are no ads in the interest groups", async () => {
    const fakeServerHandler =
      jasmine.createSpy<FakeServerHandler>("fakeServerHandler");
    setFakeServerHandler(fakeServerHandler);
    expect(
      await storeInterestGroup({
        name,
        biddingLogicUrl: biddingLogicUrl1,
        trustedBiddingSignalsUrl,
        ads: [],
      })
    ).toBeTrue();
    await runAdAuction(
      { decisionLogicUrl, trustedScoringSignalsUrl },
      hostname,
      allowedLogicUrlPrefixes
    );
    expect(fakeServerHandler).not.toHaveBeenCalled();
  });

  it("should not fetch trusted scoring signals if no URL is provided", async () => {
    const fakeServerHandler =
      jasmine.createSpy<FakeServerHandler>("fakeServerHandler");
    fakeServerHandler
      .withArgs(
        jasmine.objectContaining<FakeRequest>({
          url: new URL(biddingLogicUrl1),
        })
      )
      .and.resolveTo({
        headers: javaScriptHeaders,
        body: [
          "function generateBid() {",
          "  return { ad: null, bid: 0.03, render: 'about:blank#2' };",
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
        headers: javaScriptHeaders,
        body: "function scoreAd() { return 10; }",
      });
    fakeServerHandler
      .withArgs(
        jasmine.objectContaining<FakeRequest>({
          url: new URL(trustedBiddingSignalsUrl + "?hostname=www.example.com"),
        })
      )
      .and.resolveTo(trustedSignalsResponse);
    setFakeServerHandler(fakeServerHandler);
    expect(
      await storeInterestGroup({
        name,
        biddingLogicUrl: biddingLogicUrl1,
        trustedBiddingSignalsUrl,
        ads: [ad1, ad2],
      })
    ).toBeTrue();
    expect(
      await runAdAuction(
        { decisionLogicUrl },
        hostname,
        allowedLogicUrlPrefixes
      )
    ).toBeTruthy();
    expect(fakeServerHandler).toHaveBeenCalledTimes(3);
    expect(fakeServerHandler).toHaveBeenCalledWith(
      jasmine.objectContaining<FakeRequest>({
        url: new URL(biddingLogicUrl1),
      })
    );
    expect(fakeServerHandler).toHaveBeenCalledWith(
      jasmine.objectContaining<FakeRequest>({
        url: new URL(decisionLogicUrl),
      })
    );
    expect(fakeServerHandler).toHaveBeenCalledWith(
      jasmine.objectContaining<FakeRequest>({
        url: new URL(trustedBiddingSignalsUrl + "?hostname=www.example.com"),
      })
    );
  });

  it("should log a warning and not fetch trusted scoring signals if URL is ill-formed", async () => {
    await storeInterestGroup({
      name,
      biddingLogicUrl: biddingLogicUrl1,
      ads: [ad1, ad2],
    });
    const fakeServerHandler = jasmine
      .createSpy<FakeServerHandler>("fakeServerHandler")
      .and.resolveTo({
        headers: javaScriptHeaders,
        body: [
          "function generateBid() {",
          "  return { ad: null, bid: 0.03, render: 'about:blank#2' };",
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
        headers: javaScriptHeaders,
        body: "function scoreAd() { return 10; }",
      });
    setFakeServerHandler(fakeServerHandler);
    const consoleSpy = spyOnAllFunctions(console);
    const notUrl = "https://invalid@";
    expect(
      await runAdAuction(
        { decisionLogicUrl, trustedScoringSignalsUrl: notUrl },
        hostname,
        allowedLogicUrlPrefixes
      )
    ).toBeTruthy();
    expect(fakeServerHandler).toHaveBeenCalledTimes(2);
    expect(fakeServerHandler).toHaveBeenCalledWith(
      jasmine.objectContaining<FakeRequest>({
        url: new URL(biddingLogicUrl1),
      })
    );
    expect(fakeServerHandler).toHaveBeenCalledWith(
      jasmine.objectContaining<FakeRequest>({
        url: new URL(decisionLogicUrl),
      })
    );
    expect(consoleSpy.warn).toHaveBeenCalledOnceWith(
      jasmine.any(String),
      notUrl
    );
  });

  it("should log a warning and not fetch trusted scoring signals if URL has a query string", async () => {
    const fakeServerHandler = jasmine
      .createSpy<FakeServerHandler>("fakeServerHandler")
      .and.resolveTo({
        headers: javaScriptHeaders,
        body: [
          "function generateBid() {",
          "  return { ad: null, bid: 0.03, render: 'about:blank#2' };",
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
        headers: javaScriptHeaders,
        body: "function scoreAd() { return 10; }",
      });
    setFakeServerHandler(fakeServerHandler);
    await storeInterestGroup({
      name,
      biddingLogicUrl: biddingLogicUrl1,
      ads: [ad1, ad2],
    });
    const consoleSpy = spyOnAllFunctions(console);
    const url = trustedScoringSignalsUrl + "?key=value";
    expect(
      await runAdAuction(
        { decisionLogicUrl, trustedScoringSignalsUrl: url },
        hostname,
        allowedLogicUrlPrefixes
      )
    ).toBeTruthy();
    expect(fakeServerHandler).toHaveBeenCalledTimes(2);
    expect(fakeServerHandler).toHaveBeenCalledWith(
      jasmine.objectContaining<FakeRequest>({
        url: new URL(biddingLogicUrl1),
      })
    );
    expect(fakeServerHandler).toHaveBeenCalledWith(
      jasmine.objectContaining<FakeRequest>({
        url: new URL(decisionLogicUrl),
      })
    );
    expect(consoleSpy.warn).toHaveBeenCalledOnceWith(jasmine.any(String), url);
  });

  it("should log a warning if MIME type is wrong", async () => {
    const mimeType = "text/html";
    const fakeServerHandler =
      jasmine.createSpy<FakeServerHandler>("fakeServerHandler");
    fakeServerHandler
      .withArgs(
        jasmine.objectContaining<FakeRequest>({
          url: new URL(biddingLogicUrl1),
        })
      )
      .and.resolveTo({
        headers: javaScriptHeaders,
        body: [
          "function generateBid() {",
          "  return { ad: null, bid: 0.03, render: 'about:blank#1' };",
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
        headers: javaScriptHeaders,
        body: "function scoreAd() { return 10; }",
      });
    fakeServerHandler
      .withArgs(
        jasmine.objectContaining<FakeRequest>({
          url: new URL(trustedScoringSignalsUrl + "?keys=about%3Ablank%231"),
        })
      )
      .and.resolveTo({
        headers: {
          "Content-Type": mimeType,
          "X-Allow-FLEDGE": "true",
        },
        body: '{"a": 1?}',
      });
    setFakeServerHandler(fakeServerHandler);
    const consoleSpy = spyOnAllFunctions(console);
    expect(
      await storeInterestGroup({
        name,
        biddingLogicUrl: biddingLogicUrl1,
        ads: [ad1, ad2],
      })
    ).toBeTrue();
    expect(
      await runAdAuction(
        { decisionLogicUrl, trustedScoringSignalsUrl },
        hostname,
        allowedLogicUrlPrefixes
      )
    ).toBeTruthy();
    expect(consoleSpy.warn).toHaveBeenCalledOnceWith(
      jasmine.any(String),
      trustedScoringSignalsUrl + "?keys=about%3Ablank%231",
      jasmine.any(String),
      mimeType
    );
  });

  it("should log a warning if JSON is ill-formed", async () => {
    const fakeServerHandler =
      jasmine.createSpy<FakeServerHandler>("fakeServerHandler");
    fakeServerHandler
      .withArgs(
        jasmine.objectContaining<FakeRequest>({
          url: new URL(biddingLogicUrl1),
        })
      )
      .and.resolveTo({
        headers: javaScriptHeaders,
        body: [
          "function generateBid() {",
          "  return { ad: null, bid: 0.03, render: 'about:blank#1' };",
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
        headers: javaScriptHeaders,
        body: "function scoreAd() { return 10; }",
      });
    fakeServerHandler
      .withArgs(
        jasmine.objectContaining<FakeRequest>({
          url: new URL(trustedScoringSignalsUrl + "?keys=about%3Ablank%231"),
        })
      )
      .and.resolveTo({
        headers: jsonHeaders,
        body: '{"a": 1?}',
      });
    setFakeServerHandler(fakeServerHandler);
    const consoleSpy = spyOnAllFunctions(console);
    expect(
      await storeInterestGroup({
        name,
        biddingLogicUrl: biddingLogicUrl1,
        ads: [ad1, ad2],
      })
    ).toBeTrue();
    expect(
      await runAdAuction(
        { decisionLogicUrl, trustedScoringSignalsUrl },
        hostname,
        allowedLogicUrlPrefixes
      )
    ).toBeTruthy();
    expect(consoleSpy.warn).toHaveBeenCalledOnceWith(
      jasmine.any(String),
      trustedScoringSignalsUrl + "?keys=about%3Ablank%231",
      // Illegal character is at position 7 in the string
      jasmine.stringMatching(/.*\b7\b.*/)
    );
  });

  it("should log a warning if JSON value is not an object", async () => {
    const fakeServerHandler =
      jasmine.createSpy<FakeServerHandler>("fakeServerHandler");
    fakeServerHandler
      .withArgs(
        jasmine.objectContaining<FakeRequest>({
          url: new URL(biddingLogicUrl1),
        })
      )
      .and.resolveTo({
        headers: javaScriptHeaders,
        body: [
          "function generateBid() {",
          "  return { ad: null, bid: 0.03, render: 'about:blank#1' };",
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
        headers: javaScriptHeaders,
        body: "function scoreAd() { return 10; }",
      });
    fakeServerHandler
      .withArgs(
        jasmine.objectContaining<FakeRequest>({
          url: new URL(trustedScoringSignalsUrl + "?keys=about%3Ablank%231"),
        })
      )
      .and.resolveTo({
        headers: jsonHeaders,
        body: "3",
      });
    setFakeServerHandler(fakeServerHandler);
    const consoleSpy = spyOnAllFunctions(console);
    expect(
      await storeInterestGroup({
        name,
        biddingLogicUrl: biddingLogicUrl1,
        ads: [ad1, ad2],
      })
    ).toBeTrue();
    expect(
      await runAdAuction(
        { decisionLogicUrl, trustedScoringSignalsUrl },
        hostname,
        allowedLogicUrlPrefixes
      )
    ).toBeTruthy();
    expect(consoleSpy.warn).toHaveBeenCalledOnceWith(
      jasmine.any(String),
      trustedScoringSignalsUrl + "?keys=about%3Ablank%231",
      jasmine.any(String),
      3
    );
  });

  it("should not log on network error when fetching trusted scoring signals", async () => {
    const fakeServerHandler =
      jasmine.createSpy<FakeServerHandler>("fakeServerHandler");
    fakeServerHandler
      .withArgs(
        jasmine.objectContaining<FakeRequest>({
          url: new URL(biddingLogicUrl1),
        })
      )
      .and.resolveTo({
        headers: javaScriptHeaders,
        body: [
          "function generateBid() {",
          "  return { ad: null, bid: 0.03, render: 'about:blank#1' };",
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
        headers: javaScriptHeaders,
        body: "function scoreAd() { return 10; }",
      });
    setFakeServerHandler(fakeServerHandler);
    const consoleSpy = spyOnAllFunctions(console);
    expect(
      await storeInterestGroup({
        name,
        biddingLogicUrl: biddingLogicUrl1,
        ads: [ad1, ad2],
      })
    ).toBeTrue();
    expect(
      await runAdAuction(
        { decisionLogicUrl, trustedScoringSignalsUrl: "invalid-scheme://" },
        hostname,
        allowedLogicUrlPrefixes
      )
    ).toBeTruthy();
    expect(consoleSpy.error).not.toHaveBeenCalled();
    expect(consoleSpy.warn).not.toHaveBeenCalled();
  });

  it("should not log if trusted bidding and scoring signals are fetched successfully", async () => {
    const fakeServerHandler =
      jasmine.createSpy<FakeServerHandler>("fakeServerHandler");
    fakeServerHandler
      .withArgs(
        jasmine.objectContaining<FakeRequest>({
          url: new URL(biddingLogicUrl1),
        })
      )
      .and.resolveTo({
        headers: javaScriptHeaders,
        body: [
          "function generateBid() {",
          "  return { ad: null, bid: 0.03, render: 'about:blank#1' };",
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
        headers: javaScriptHeaders,
        body: "function scoreAd() { return 10; }",
      });
    fakeServerHandler
      .withArgs(
        jasmine.objectContaining<FakeRequest>({
          url: new URL(trustedScoringSignalsUrl + "?keys=about%3Ablank%231"),
        })
      )
      .and.resolveTo(trustedSignalsResponse);
    fakeServerHandler
      .withArgs(
        jasmine.objectContaining<FakeRequest>({
          url: new URL(trustedBiddingSignalsUrl + "?hostname=www.example.com"),
        })
      )
      .and.resolveTo(trustedSignalsResponse);
    setFakeServerHandler(fakeServerHandler);
    const consoleSpy = spyOnAllFunctions(console);
    expect(
      await storeInterestGroup({
        name,
        biddingLogicUrl: biddingLogicUrl1,
        trustedBiddingSignalsUrl,
        ads: [ad1, ad2],
      })
    ).toBeTrue();
    expect(
      await runAdAuction(
        { decisionLogicUrl, trustedScoringSignalsUrl },
        hostname,
        allowedLogicUrlPrefixes
      )
    ).toBeTruthy();
    expect(fakeServerHandler).toHaveBeenCalledWith(
      jasmine.objectContaining<FakeRequest>({
        url: new URL(trustedBiddingSignalsUrl + "?hostname=www.example.com"),
      })
    );
    expect(fakeServerHandler).toHaveBeenCalledWith(
      jasmine.objectContaining<FakeRequest>({
        url: new URL(trustedScoringSignalsUrl + "?keys=about%3Ablank%231"),
      })
    );
    expect(consoleSpy.error).not.toHaveBeenCalled();
    expect(consoleSpy.warn).not.toHaveBeenCalled();
  });

  it("should not log if there are no ads", async () => {
    const consoleSpy = spyOnAllFunctions(console);
    expect(
      await runAdAuction(
        { decisionLogicUrl, trustedScoringSignalsUrl },
        hostname,
        allowedLogicUrlPrefixes
      )
    ).toBeTruthy();
    expect(consoleSpy.error).not.toHaveBeenCalled();
    expect(consoleSpy.warn).not.toHaveBeenCalled();
  });

  it("should not log if no URL is provided", async () => {
    expect(await storeInterestGroup({ name, ads: [ad1, ad2] })).toBeTrue();
    const consoleSpy = spyOnAllFunctions(console);
    expect(
      await runAdAuction(
        { decisionLogicUrl },
        hostname,
        allowedLogicUrlPrefixes
      )
    ).toBeTruthy();
    expect(consoleSpy.error).not.toHaveBeenCalled();
    expect(consoleSpy.warn).not.toHaveBeenCalled();
  });
});
