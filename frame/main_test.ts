/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import "jasmine";
import * as uuid from "uuid";
import {
  awaitMessageFromSelfToSelf,
  awaitMessageToPort,
} from "../lib/shared/messaging";
import {
  FledgeRequest,
  RequestTag,
  RunAdAuctionResponse,
  isRunAdAuctionResponse,
} from "../lib/shared/protocol";
import { VERSION, VERSION_KEY } from "../lib/shared/version";
import { cleanDomAfterEach } from "../lib/shared/testing/dom";
import { clearStorageBeforeAndAfter } from "../lib/shared/testing/storage";
import { main } from "./main";

describe("main", () => {
  cleanDomAfterEach();
  clearStorageBeforeAndAfter();

  const renderingUrl = "about:blank#ad";

  it("should connect to parent window and handle requests from it", async () => {
    const iframe = document.createElement("iframe");
    document.body.appendChild(iframe);
    const handshakeMessageEventPromise = awaitMessageFromSelfToSelf();
    main(iframe.contentWindow!);
    const { data: handshakeData, ports } = await handshakeMessageEventPromise;
    expect(handshakeData).toEqual({ [VERSION_KEY]: VERSION });
    expect(ports).toHaveSize(1);
    const [port] = ports;
    const joinRequest: FledgeRequest = [
      RequestTag.JOIN_AD_INTEREST_GROUP,
      ["interest group name", [[renderingUrl, 0.02]]],
    ];
    port.postMessage(joinRequest);
    const { port1: receiver, port2: sender } = new MessageChannel();
    const auctionMessageEventPromise = awaitMessageToPort(receiver);
    const auctionRequest: FledgeRequest = [RequestTag.RUN_AD_AUCTION, null];
    port.postMessage(auctionRequest, [sender]);
    const { data: auctionResponse } = await auctionMessageEventPromise;
    expect(isRunAdAuctionResponse(auctionResponse)).toBeTrue();
    expect((auctionResponse as RunAdAuctionResponse)[0]).toBeTrue();
    expect(sessionStorage.getItem((auctionResponse as [true, string])[1])).toBe(
      renderingUrl
    );
  });

  it("should render an ad", () => {
    const token = uuid.v4();
    sessionStorage.setItem(token, renderingUrl);
    const iframe = document.createElement("iframe");
    iframe.src = "about:blank#" + token;
    document.body.appendChild(iframe);
    main(iframe.contentWindow!);
    expect(iframe.contentDocument!.querySelector("iframe")!.src).toBe(
      renderingUrl
    );
  });

  it("should throw on invalid token", () => {
    const token = uuid.v4();
    const iframe = document.createElement("iframe");
    iframe.src = "about:blank#" + token;
    document.body.appendChild(iframe);
    expect(() => {
      main(iframe.contentWindow!);
    }).toThrowError();
  });

  it("should throw if running on top window", () => {
    expect(() => {
      main(top);
    }).toThrowError();
  });
});
