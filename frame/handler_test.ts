/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import "jasmine";
import { awaitMessageToPort } from "../lib/shared/messaging";
import {
  isRunAdAuctionResponse,
  messageDataFromRequest,
  RequestKind,
} from "../lib/shared/protocol";
import {
  assertToBeString,
  assertToBeTruthy,
  assertToSatisfyTypeGuard,
} from "../testing/assert";
import {
  FakeRequest,
  FakeServerHandler,
  setFakeServerHandler,
} from "../testing/http";
import { addMessagePortMatchers } from "../testing/messaging";
import { clearStorageBeforeAndAfter } from "../testing/storage";
import { forEachInterestGroup, InterestGroupCallback } from "./db_schema";
import { handleRequest } from "./handler";

describe("handleRequest", () => {
  clearStorageBeforeAndAfter();
  beforeAll(addMessagePortMatchers);

  const hostname = "www.example.com";
  const allowedLogicUrlPrefixes = ["https://dsp.test/", "https://ssp.test/"];

  for (const badInput of [
    null,
    new Blob(),
    [],
    [undefined],
    [RequestKind.JOIN_AD_INTEREST_GROUP, true],
    [RequestKind.LEAVE_AD_INTEREST_GROUP, 0.02],
    [RequestKind.RUN_AD_AUCTION, []],
  ]) {
    it(`should log an error, close ports, and not reply to ${JSON.stringify(
      badInput
    )}`, async () => {
      const consoleSpy = spyOnAllFunctions(console);
      const { port1: receiver, port2: sender } = new MessageChannel();
      const messageEventPromise = awaitMessageToPort(receiver);
      await handleRequest(
        new MessageEvent("message", { data: badInput, ports: [sender] }),
        hostname,
        allowedLogicUrlPrefixes
      );
      expect(consoleSpy.error).toHaveBeenCalledOnceWith(
        jasmine.any(String),
        badInput
      );
      await expectAsync(receiver).not.toBeEntangledWith(sender);
      await expectAsync(messageEventPromise).toBePending();
    });
  }

  it("should log an error, close ports, and not reply on port transfer mismatch", async () => {
    const consoleSpy = spyOnAllFunctions(console);
    const channel = new MessageChannel();
    const messageEventPromise = awaitMessageToPort(channel.port1);
    const otherChannel = new MessageChannel();
    await handleRequest(
      new MessageEvent("message", {
        data: messageDataFromRequest({
          kind: RequestKind.RUN_AD_AUCTION,
          config: { decisionLogicUrl },
        }),
        ports: [channel.port2, otherChannel.port1, otherChannel.port2],
      }),
      hostname,
      allowedLogicUrlPrefixes
    );
    expect(consoleSpy.error).toHaveBeenCalledOnceWith(
      jasmine.stringMatching(/.*\b3\b.*/)
    );
    await expectAsync(channel.port1).not.toBeEntangledWith(channel.port2);
    await expectAsync(otherChannel.port1).not.toBeEntangledWith(
      otherChannel.port2
    );
    await expectAsync(messageEventPromise).toBePending();
  });

  const name = "interest group name";
  const biddingLogicUrl = "https://dsp.test/bidder.js";
  const decisionLogicUrl = "https://ssp.test/scorer.js";
  const trustedBiddingSignalsUrl = "https://trusted-server.test/bidding";
  const renderUrl = "about:blank";
  const ads = [{ renderUrl, metadata: { "price": 0.02 } }];
  const group = { name, biddingLogicUrl, trustedBiddingSignalsUrl, ads };
  const joinMessageEvent = new MessageEvent("message", {
    data: messageDataFromRequest({
      kind: RequestKind.JOIN_AD_INTEREST_GROUP,
      group,
    }),
  });

  it("should join an interest group", async () => {
    await handleRequest(joinMessageEvent, hostname, allowedLogicUrlPrefixes);
    const callback = jasmine.createSpy<InterestGroupCallback>("callback");
    expect(await forEachInterestGroup(callback)).toBeTrue();
    expect(callback).toHaveBeenCalledOnceWith(group);
  });

  it("should partially overwrite an existing interest group", async () => {
    await handleRequest(joinMessageEvent, hostname, allowedLogicUrlPrefixes);
    const newTrustedBiddingSignalsUrl = "https://trusted-server-2.test/bidding";
    await handleRequest(
      new MessageEvent("message", {
        data: messageDataFromRequest({
          kind: RequestKind.JOIN_AD_INTEREST_GROUP,
          group: {
            name,
            trustedBiddingSignalsUrl: newTrustedBiddingSignalsUrl,
          },
        }),
      }),
      hostname,
      allowedLogicUrlPrefixes
    );
    const callback = jasmine.createSpy<InterestGroupCallback>("callback");
    expect(await forEachInterestGroup(callback)).toBeTrue();
    expect(callback).toHaveBeenCalledOnceWith({
      name,
      biddingLogicUrl,
      trustedBiddingSignalsUrl: newTrustedBiddingSignalsUrl,
      ads,
    });
  });

  it("should log an error and not join an interest group if bidding logic URL is not allowlisted", async () => {
    const consoleSpy = spyOnAllFunctions(console);
    await handleRequest(joinMessageEvent, hostname, [
      "https://different-allowlist.test/",
    ]);
    const callback = jasmine.createSpy<InterestGroupCallback>("callback");
    expect(await forEachInterestGroup(callback)).toBeTrue();
    expect(callback).not.toHaveBeenCalled();
    expect(consoleSpy.error).toHaveBeenCalledOnceWith(
      jasmine.any(String),
      biddingLogicUrl
    );
  });

  it("should leave an interest group", async () => {
    await handleRequest(joinMessageEvent, hostname, allowedLogicUrlPrefixes);
    await handleRequest(
      new MessageEvent("message", {
        data: messageDataFromRequest({
          kind: RequestKind.LEAVE_AD_INTEREST_GROUP,
          group,
        }),
      }),
      hostname,
      allowedLogicUrlPrefixes
    );
    const callback = jasmine.createSpy<InterestGroupCallback>("callback");
    expect(await forEachInterestGroup(callback)).toBeTrue();
    expect(callback).not.toHaveBeenCalled();
  });

  it("should run an ad auction", async () => {
    const trustedScoringSignalsUrl = "https://trusted-server.test/scoring";
    const trustedSignalsResponse = {
      headers: {
        "Content-Type": "application/json",
        "X-Allow-FLEDGE": "true",
      },
      body: '{"a": 1, "b": [true, null]}',
    };
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
          "      trustedBiddingSignalsUrl ===",
          "        'https://trusted-server.test/bidding' &&",
          "      ads.length === 1 &&",
          "      ads[0].renderUrl === 'about:blank' &&",
          "      ads[0].metadata['price'] === 0.02",
          "    )",
          "  ) {",
          "    throw new Error();",
          "  }",
          "  return { ad: 'Metadata', bid: 0.03, render: 'about:blank' };",
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
          "  { decisionLogicUrl, trustedScoringSignalsUrl },",
          ") {",
          "  if (",
          "    !(",
          "      adMetadata === 'Metadata' &&",
          "      bid === 0.03 &&",
          "      decisionLogicUrl === 'https://ssp.test/scorer.js' &&",
          "      trustedScoringSignalsUrl ===",
          "        'https://trusted-server.test/scoring'",
          "    )",
          "  ) {",
          "    throw new Error();",
          "  }",
          "  return 10;",
          "}",
        ].join("\n"),
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
          url: new URL(trustedScoringSignalsUrl + "?keys=about%3Ablank"),
        })
      )
      .and.resolveTo(trustedSignalsResponse);
    setFakeServerHandler(fakeServerHandler);
    const consoleSpy = spyOnAllFunctions(console);
    await handleRequest(joinMessageEvent, hostname, allowedLogicUrlPrefixes);
    const { port1: receiver, port2: sender } = new MessageChannel();
    const messageEventPromise = awaitMessageToPort(receiver);
    await handleRequest(
      new MessageEvent("message", {
        data: messageDataFromRequest({
          kind: RequestKind.RUN_AD_AUCTION,
          config: { decisionLogicUrl, trustedScoringSignalsUrl },
        }),
        ports: [sender],
      }),
      hostname,
      allowedLogicUrlPrefixes
    );
    const event = await messageEventPromise;
    assertToBeTruthy(event);
    const { data } = event;
    assertToSatisfyTypeGuard(data, isRunAdAuctionResponse);
    assertToBeString(data);
    expect(sessionStorage.getItem(data)).toBe(renderUrl);
    expect(fakeServerHandler).toHaveBeenCalledTimes(4);
    expect(fakeServerHandler).toHaveBeenCalledWith(
      jasmine.objectContaining<FakeRequest>({
        url: new URL(biddingLogicUrl),
        method: "GET",
        hasCredentials: false,
      })
    );
    expect(fakeServerHandler).toHaveBeenCalledWith(
      jasmine.objectContaining<FakeRequest>({
        url: new URL(decisionLogicUrl),
        method: "GET",
        hasCredentials: false,
      })
    );
    expect(fakeServerHandler).toHaveBeenCalledWith(
      jasmine.objectContaining<FakeRequest>({
        url: new URL(trustedBiddingSignalsUrl + "?hostname=www.example.com"),
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
    expect(consoleSpy.error).not.toHaveBeenCalled();
    expect(consoleSpy.warn).not.toHaveBeenCalled();
    await expectAsync(receiver).not.toBeEntangledWith(sender);
  });
});
