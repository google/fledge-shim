/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import "jasmine";
import { awaitMessageToPort } from "../lib/shared/messaging";
import {
  FledgeRequest,
  isRunAdAuctionResponse,
  RequestTag,
  RunAdAuctionResponse,
} from "../lib/shared/protocol";
import { clearStorageBeforeAndAfter } from "../lib/shared/testing/storage";
import { Ad, getAllAds } from "./database";
import { handleRequest } from "./handler";

describe("handleRequest", () => {
  clearStorageBeforeAndAfter();

  for (const badInput of [
    undefined,
    [],
    [null],
    [RequestTag.JOIN_AD_INTEREST_GROUP, true],
    [RequestTag.LEAVE_AD_INTEREST_GROUP, 0.02],
    [RequestTag.RUN_AD_AUCTION, "bad"],
  ]) {
    const errorResponse: RunAdAuctionResponse = [false];

    it(`should reply with error message to ${JSON.stringify(
      badInput
    )}`, async () => {
      const { port1: receiver, port2: sender } = new MessageChannel();
      const messageEventPromise = awaitMessageToPort(receiver);
      await expectAsync(
        handleRequest(
          new MessageEvent("message", { data: badInput, ports: [sender] })
        )
      ).toBeRejectedWithError();
      expect((await messageEventPromise).data).toEqual(errorResponse);
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
          })
        )
      ).toBeRejectedWithError();
      expect((await messageEventPromise1).data).toEqual(errorResponse);
      expect((await messageEventPromise2).data).toEqual(errorResponse);
    });
  }

  const name = "interest group name";
  const renderingUrl = "about:blank";
  const ads: Ad[] = [[renderingUrl, 0.02]];
  const joinRequest: FledgeRequest = [
    RequestTag.JOIN_AD_INTEREST_GROUP,
    [name, ads],
  ];
  const joinMessageEvent = new MessageEvent("message", { data: joinRequest });

  it("should join an interest group", async () => {
    await handleRequest(joinMessageEvent);
    expect([...(await getAllAds())]).toEqual(ads);
  });

  it("should leave an interest group", async () => {
    await handleRequest(joinMessageEvent);
    const leaveRequest: FledgeRequest = [
      RequestTag.LEAVE_AD_INTEREST_GROUP,
      name,
    ];
    await handleRequest(new MessageEvent("message", { data: leaveRequest }));
    expect([...(await getAllAds())]).toEqual([]);
  });

  it("should run an ad auction", async () => {
    await handleRequest(joinMessageEvent);
    const { port1: receiver, port2: sender } = new MessageChannel();
    const messageEventPromise = awaitMessageToPort(receiver);
    const auctionRequest: FledgeRequest = [RequestTag.RUN_AD_AUCTION, null];
    await handleRequest(
      new MessageEvent("message", {
        data: auctionRequest,
        ports: [sender],
      })
    );
    const { data } = await messageEventPromise;
    expect(isRunAdAuctionResponse(data)).toBeTrue();
    expect((data as RunAdAuctionResponse)[0]).toBeTrue();
    expect(sessionStorage.getItem((data as [true, string])[1])).toBe(
      renderingUrl
    );
  });
});
