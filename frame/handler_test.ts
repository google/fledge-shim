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
import { assertToBeString, assertToSatisfyTypeGuard } from "../testing/assert";
import {
  FakeRequest,
  FakeServerHandler,
  setFakeServerHandler,
} from "../testing/http";
import { clearStorageBeforeAndAfter } from "../testing/storage";
import { forEachInterestGroup, InterestGroupCallback } from "./db_schema";
import { handleRequest } from "./handler";

describe("handleRequest", () => {
  clearStorageBeforeAndAfter();

  const hostname = "www.example.com";

  for (const badInput of [
    null,
    new Blob(),
    [],
    [undefined],
    [RequestKind.JOIN_AD_INTEREST_GROUP, true],
    [RequestKind.LEAVE_AD_INTEREST_GROUP, 0.02],
    [RequestKind.RUN_AD_AUCTION, []],
  ]) {
    it(`should reply with error message to ${JSON.stringify(
      badInput
    )}`, async () => {
      const { port1: receiver, port2: sender } = new MessageChannel();
      const messageEventPromise = awaitMessageToPort(receiver);
      await expectAsync(
        handleRequest(
          new MessageEvent("message", { data: badInput, ports: [sender] }),
          hostname
        )
      ).toBeRejectedWithError();
      expect((await messageEventPromise).data).toBeFalse();
    });

    it(`should reply with error message on multiple ports to ${JSON.stringify(
      badInput
    )}`, async () => {
      const { port1: receiver1, port2: sender1 } = new MessageChannel();
      const messageEventPromise1 = awaitMessageToPort(receiver1);
      const { port1: receiver2, port2: sender2 } = new MessageChannel();
      const messageEventPromise2 = awaitMessageToPort(receiver2);
      await expectAsync(
        handleRequest(
          new MessageEvent("message", {
            data: badInput,
            ports: [sender1, sender2],
          }),
          hostname
        )
      ).toBeRejectedWithError();
      expect((await messageEventPromise1).data).toBeFalse();
      expect((await messageEventPromise2).data).toBeFalse();
    });
  }

  const name = "interest group name";
  const trustedBiddingSignalsUrl = "https://trusted-server.test/bidding";
  const renderingUrl = "about:blank";
  const ads = [{ renderingUrl, metadata: { price: 0.02 } }];
  const group = { name, trustedBiddingSignalsUrl, ads };
  const joinMessageEvent = new MessageEvent("message", {
    data: messageDataFromRequest({
      kind: RequestKind.JOIN_AD_INTEREST_GROUP,
      group,
    }),
  });

  it("should join an interest group", async () => {
    await handleRequest(joinMessageEvent, hostname);
    const callback = jasmine.createSpy<InterestGroupCallback>();
    expect(await forEachInterestGroup(callback)).toBeTrue();
    expect(callback).toHaveBeenCalledOnceWith(group);
  });

  it("should partially overwrite an existing interest group", async () => {
    await handleRequest(joinMessageEvent, hostname);
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
      hostname
    );
    const callback = jasmine.createSpy<InterestGroupCallback>();
    expect(await forEachInterestGroup(callback)).toBeTrue();
    expect(callback).toHaveBeenCalledOnceWith({
      name,
      trustedBiddingSignalsUrl: newTrustedBiddingSignalsUrl,
      ads,
    });
  });

  it("should leave an interest group", async () => {
    await handleRequest(joinMessageEvent, hostname);
    await handleRequest(
      new MessageEvent("message", {
        data: messageDataFromRequest({
          kind: RequestKind.LEAVE_AD_INTEREST_GROUP,
          group,
        }),
      }),
      hostname
    );
    const callback = jasmine.createSpy<InterestGroupCallback>();
    expect(await forEachInterestGroup(callback)).toBeTrue();
    expect(callback).not.toHaveBeenCalled();
  });

  it("should run an ad auction", async () => {
    const consoleSpy = spyOnAllFunctions(console);
    await handleRequest(joinMessageEvent, hostname);
    const { port1: receiver, port2: sender } = new MessageChannel();
    const messageEventPromise = awaitMessageToPort(receiver);
    const fakeServerHandler = jasmine
      .createSpy<FakeServerHandler>()
      .and.resolveTo({
        headers: {
          "Content-Type": "application/json",
          "X-Allow-FLEDGE": "true",
        },
        body: '{"a": 1, "b": [true, null]}',
      });
    setFakeServerHandler(fakeServerHandler);
    const trustedScoringSignalsUrl = "https://trusted-server.test/scoring";
    await handleRequest(
      new MessageEvent("message", {
        data: messageDataFromRequest({
          kind: RequestKind.RUN_AD_AUCTION,
          config: { trustedScoringSignalsUrl },
        }),
        ports: [sender],
      }),
      hostname
    );
    const { data } = await messageEventPromise;
    assertToSatisfyTypeGuard(data, isRunAdAuctionResponse);
    assertToBeString(data);
    expect(sessionStorage.getItem(data)).toBe(renderingUrl);
    expect(fakeServerHandler).toHaveBeenCalledTimes(2);
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
  });
});
