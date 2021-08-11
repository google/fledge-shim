/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import "jasmine";
import {
  FledgeRequest,
  isRunAdAuctionResponse,
  messageDataFromRequest,
  requestFromMessageData,
  RequestKind,
} from "./protocol";

const requests: Array<{ request: FledgeRequest; messageData: unknown }> = [
  {
    request: {
      kind: RequestKind.JOIN_AD_INTEREST_GROUP,
      group: {
        name: "",
        biddingLogicUrl: undefined,
        trustedBiddingSignalsUrl: undefined,
        ads: undefined,
      },
    },
    messageData: [
      RequestKind.JOIN_AD_INTEREST_GROUP,
      "",
      undefined,
      undefined,
      undefined,
    ],
  },
  {
    request: {
      kind: RequestKind.JOIN_AD_INTEREST_GROUP,
      group: {
        name: "interest group name",
        biddingLogicUrl: "https://dsp.example/bidder.js",
        trustedBiddingSignalsUrl: "https://trusted-server.example/bidding",
        ads: [
          { renderUrl: "https://ad.example/1", metadata: [] },
          { renderUrl: "https://ad.example/2", metadata: {} },
          { renderUrl: "https://ad.example/3", metadata: [null] },
          { renderUrl: "https://ad.example/4", metadata: { "price": 0.04 } },
        ],
      },
    },
    messageData: [
      RequestKind.JOIN_AD_INTEREST_GROUP,
      "interest group name",
      "https://dsp.example/bidder.js",
      "https://trusted-server.example/bidding",
      [
        ["https://ad.example/1", "[]"],
        ["https://ad.example/2", "{}"],
        ["https://ad.example/3", "[null]"],
        ["https://ad.example/4", '{"price":0.04}'],
      ],
    ],
  },
  {
    request: { kind: RequestKind.LEAVE_AD_INTEREST_GROUP, group: { name: "" } },
    messageData: [RequestKind.LEAVE_AD_INTEREST_GROUP, ""],
  },
  {
    request: {
      kind: RequestKind.LEAVE_AD_INTEREST_GROUP,
      group: { name: "interest group name" },
    },
    messageData: [RequestKind.LEAVE_AD_INTEREST_GROUP, "interest group name"],
  },
  {
    request: {
      kind: RequestKind.RUN_AD_AUCTION,
      config: {
        decisionLogicUrl: "https://ssp.example/scorer.js",
        trustedScoringSignalsUrl: undefined,
      },
    },
    messageData: [
      RequestKind.RUN_AD_AUCTION,
      "https://ssp.example/scorer.js",
      undefined,
    ],
  },
  {
    request: {
      kind: RequestKind.RUN_AD_AUCTION,
      config: {
        decisionLogicUrl: "https://ssp.example/scorer.js",
        trustedScoringSignalsUrl: "https://trusted-server.example/scoring",
      },
    },
    messageData: [
      RequestKind.RUN_AD_AUCTION,
      "https://ssp.example/scorer.js",
      "https://trusted-server.example/scoring",
    ],
  },
];

describe("requestFromMessageData", () => {
  for (const { request, messageData } of requests) {
    it(`should convert message data to ${JSON.stringify(request)}`, () => {
      expect(requestFromMessageData(messageData)).toEqual(request);
    });
  }

  for (const messageData of [
    null,
    new Blob(),
    [],
    [true],
    [42],
    [
      RequestKind.JOIN_AD_INTEREST_GROUP,
      "interest group name",
      "https://dsp.example/bidder.js",
      "https://trusted-server.example/bidding",
    ],
    [
      RequestKind.JOIN_AD_INTEREST_GROUP,
      "interest group name",
      "https://dsp.example/bidder.js",
      "https://trusted-server.example/bidding",
      [],
      42,
    ],
    [
      RequestKind.JOIN_AD_INTEREST_GROUP,
      [],
      "https://dsp.example/bidder.js",
      "https://trusted-server.example/bidding",
      [],
    ],
    [
      RequestKind.JOIN_AD_INTEREST_GROUP,
      "interest group name",
      {},
      "https://trusted-server.example/bidding",
      [],
    ],
    [
      RequestKind.JOIN_AD_INTEREST_GROUP,
      "interest group name",
      "https://dsp.example/bidder.js",
      42,
      [],
    ],
    [
      RequestKind.JOIN_AD_INTEREST_GROUP,
      "interest group name",
      "https://dsp.example/bidder.js",
      "https://trusted-server.example/bidding",
      "nope",
    ],
    [
      RequestKind.JOIN_AD_INTEREST_GROUP,
      "interest group name",
      "https://dsp.example/bidder.js",
      "https://trusted-server.example/bidding",
      [null],
    ],
    [
      RequestKind.JOIN_AD_INTEREST_GROUP,
      "interest group name",
      "https://dsp.example/bidder.js",
      "https://trusted-server.example/bidding",
      [["https://ad.example/1", undefined], []],
    ],
    [
      RequestKind.JOIN_AD_INTEREST_GROUP,
      "interest group name",
      "https://dsp.example/bidder.js",
      "https://trusted-server.example/bidding",
      [
        ["https://ad.example/1", undefined, true],
        ["https://ad.example/2", undefined],
      ],
    ],
    [
      RequestKind.JOIN_AD_INTEREST_GROUP,
      "interest group name",
      "https://dsp.example/bidder.js",
      "https://trusted-server.example/bidding",
      [
        ["https://ad.example/1", undefined],
        ["https://ad.example/2", undefined],
        [42, undefined],
      ],
    ],
    [
      RequestKind.JOIN_AD_INTEREST_GROUP,
      "interest group name",
      "https://dsp.example/bidder.js",
      "https://trusted-server.example/bidding",
      [
        ["https://ad.example/1", undefined],
        ["https://ad.example/2", {}],
        ["https://ad.example/3", undefined],
      ],
    ],
    [
      RequestKind.JOIN_AD_INTEREST_GROUP,
      "interest group name",
      "https://dsp.example/bidder.js",
      "https://trusted-server.example/bidding",
      [
        ["https://ad.example/1", undefined],
        ["https://ad.example/2", "invalid JSON"],
        ["https://ad.example/3", undefined],
      ],
    ],
    [
      RequestKind.JOIN_AD_INTEREST_GROUP,
      "interest group name",
      "https://dsp.example/bidder.js",
      "https://trusted-server.example/bidding",
      [
        ["https://ad.example/1", undefined],
        ["https://ad.example/2", '"nope"'],
        ["https://ad.example/3", undefined],
      ],
    ],
    [RequestKind.LEAVE_AD_INTEREST_GROUP],
    [RequestKind.LEAVE_AD_INTEREST_GROUP, "interest group name", []],
    [RequestKind.LEAVE_AD_INTEREST_GROUP, {}],
    [RequestKind.RUN_AD_AUCTION],
    [
      RequestKind.RUN_AD_AUCTION,
      "https://trusted-server.example/scoring",
      null,
    ],
    [RequestKind.RUN_AD_AUCTION, true],
  ]) {
    it(`should fail to convert ${JSON.stringify(messageData)}`, () => {
      expect(requestFromMessageData(messageData)).toBeNull();
    });
  }
});

describe("messageDataFromRequest", () => {
  for (const { request, messageData } of requests) {
    it(`should convert ${JSON.stringify(request)} to message data`, () => {
      expect(messageDataFromRequest(request)).toEqual(messageData);
    });
  }

  it(`should lossily convert serializable request to message data`, () => {
    expect(
      messageDataFromRequest({
        kind: RequestKind.JOIN_AD_INTEREST_GROUP,
        group: {
          name: "interest group name",
          biddingLogicUrl: "https://dsp.example/bidder.js",
          trustedBiddingSignalsUrl: "https://trusted-server.example/bidding",
          ads: [
            { renderUrl: "https://ad.example/1", metadata: [undefined] },
            { renderUrl: "https://ad.example/2", metadata: [Symbol.species] },
            { renderUrl: "https://ad.example/3", metadata: [() => null] },
            { renderUrl: "https://ad.example/4", metadata: /abc/ },
            { renderUrl: "https://ad.example/5", metadata: new (class {})() },
            {
              renderUrl: "https://ad.example/6",
              metadata: new (class {
                toJSON() {
                  return [0.02];
                }
              })(),
            },
          ],
        },
      })
    ).toEqual([
      RequestKind.JOIN_AD_INTEREST_GROUP,
      "interest group name",
      "https://dsp.example/bidder.js",
      "https://trusted-server.example/bidding",
      [
        ["https://ad.example/1", "[null]"],
        ["https://ad.example/2", "[null]"],
        ["https://ad.example/3", "[null]"],
        ["https://ad.example/4", "{}"],
        ["https://ad.example/5", "{}"],
        ["https://ad.example/6", "[0.02]"],
      ],
    ]);
  });

  it("should handle optional fields", () => {
    expect(
      messageDataFromRequest({
        kind: RequestKind.JOIN_AD_INTEREST_GROUP,
        group: { name: "interest group name" },
      })
    ).toEqual([
      RequestKind.JOIN_AD_INTEREST_GROUP,
      "interest group name",
      undefined,
      undefined,
      undefined,
    ]);
  });

  it("should ignore inapplicable fields", () => {
    expect(
      messageDataFromRequest({
        kind: RequestKind.LEAVE_AD_INTEREST_GROUP,
        group: {
          name: "interest group name",
          biddingLogicUrl: "https://dsp.example/bidder.js",
          trustedBiddingSignalsUrl: "https://trusted-server.example/bidding",
          ads: [
            { renderUrl: "https://ad.example/1", metadata: { "price": 0.02 } },
            { renderUrl: "https://ad.example/2", metadata: { "price": 0.04 } },
          ],
        },
      })
    ).toEqual([RequestKind.LEAVE_AD_INTEREST_GROUP, "interest group name"]);
  });

  it("should fail to convert function metadata", () => {
    expect(() => {
      messageDataFromRequest({
        kind: RequestKind.JOIN_AD_INTEREST_GROUP,
        group: {
          name: "interest group name",
          biddingLogicUrl: "https://dsp.example/bidder.js",
          ads: [{ renderUrl: "https://ad.example/1", metadata: () => null }],
        },
      });
    }).toThrowError();
  });

  it("should fail to convert cyclic metadata", () => {
    const metadata: { prop?: unknown } = {};
    metadata.prop = metadata;
    expect(() => {
      messageDataFromRequest({
        kind: RequestKind.JOIN_AD_INTEREST_GROUP,
        group: {
          name: "interest group name",
          biddingLogicUrl: "https://dsp.example/bidder.js",
          ads: [{ renderUrl: "https://ad.example/1", metadata }],
        },
      });
    }).toThrowError();
  });
});

describe("isRunAdAuctionResponse", () => {
  for (const messageData of [true, false, "", "token"]) {
    it(`should return true for ${JSON.stringify(messageData)}`, () => {
      expect(isRunAdAuctionResponse(messageData)).toBeTrue();
    });
  }

  for (const messageData of [42, new Blob()]) {
    it(`should return false for ${JSON.stringify(messageData)}`, () => {
      expect(isRunAdAuctionResponse(messageData)).toBeFalse();
    });
  }
});
