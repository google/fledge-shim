/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import "jasmine";
import {
  awaitMessageFromSelfToSelf,
  awaitMessageToPort,
} from "../lib/shared/messaging";
import {
  isRunAdAuctionResponse,
  messageDataFromRequest,
  RequestKind,
} from "../lib/shared/protocol";
import { VERSION, VERSION_KEY } from "../lib/shared/version";
import {
  assertToBeString,
  assertToBeTruthy,
  assertToSatisfyTypeGuard,
} from "../testing/assert";
import { cleanDomAfterEach } from "../testing/dom";
import { setFakeServerHandler } from "../testing/http";
import { clearStorageBeforeAndAfter } from "../testing/storage";
import { main } from "./main";

describe("main", () => {
  cleanDomAfterEach();
  clearStorageBeforeAndAfter();

  const allowedLogicUrlPrefixesJoined = "https://dsp.test/";
  const renderUrl = "about:blank#ad";

  it("should connect to parent window and handle requests from it", async () => {
    setFakeServerHandler(() =>
      Promise.resolve({
        headers: {
          "Content-Type": "application/javascript",
          "X-Allow-FLEDGE": "true",
        },
        body: [
          "function generateBid() {",
          "  return { bid: 0.03, render: 'about:blank#ad' };",
          "}",
        ].join("\n"),
      })
    );
    const iframe = document.createElement("iframe");
    document.body.appendChild(iframe);
    const handshakeMessageEventPromise = awaitMessageFromSelfToSelf();
    assertToBeTruthy(iframe.contentWindow);
    main(iframe.contentWindow, allowedLogicUrlPrefixesJoined);
    const handshakeMessageEvent = await handshakeMessageEventPromise;
    assertToBeTruthy(handshakeMessageEvent);
    expect(handshakeMessageEvent.data).toEqual({ [VERSION_KEY]: VERSION });
    expect(handshakeMessageEvent.ports).toHaveSize(1);
    const [port] = handshakeMessageEvent.ports;
    port.postMessage(
      messageDataFromRequest({
        kind: RequestKind.JOIN_AD_INTEREST_GROUP,
        group: {
          name: "interest group name",
          biddingLogicUrl: "https://dsp.test/bidder.js",
          ads: [{ renderUrl, metadata: { price: 0.02 } }],
        },
      })
    );
    const { port1: receiver, port2: sender } = new MessageChannel();
    const auctionMessageEventPromise = awaitMessageToPort(receiver);
    port.postMessage(
      messageDataFromRequest({ kind: RequestKind.RUN_AD_AUCTION, config: {} }),
      [sender]
    );
    const auctionMessageEvent = await auctionMessageEventPromise;
    assertToBeTruthy(auctionMessageEvent);
    const { data: auctionResponse } = auctionMessageEvent;
    assertToSatisfyTypeGuard(auctionResponse, isRunAdAuctionResponse);
    assertToBeString(auctionResponse);
    expect(sessionStorage.getItem(auctionResponse)).toBe(renderUrl);
  });

  const token = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

  it("should render an ad", () => {
    sessionStorage.setItem(token, renderUrl);
    const outerIframe = document.createElement("iframe");
    outerIframe.src = "about:blank#" + token;
    document.body.appendChild(outerIframe);
    assertToBeTruthy(outerIframe.contentWindow);
    main(outerIframe.contentWindow, allowedLogicUrlPrefixesJoined);
    const innerIframe =
      outerIframe.contentWindow.document.querySelector("iframe");
    assertToBeTruthy(innerIframe);
    expect(innerIframe.src).toBe(renderUrl);
  });

  it("should render with the exact same dimensions as the outer iframe, with no borders or scrollbars", async () => {
    sessionStorage.setItem(token, renderUrl);
    const outerIframe = document.createElement("iframe");
    outerIframe.src = "about:blank#" + token;
    outerIframe.style.width = "123px";
    outerIframe.style.height = "45px";
    document.body.appendChild(outerIframe);
    assertToBeTruthy(outerIframe.contentWindow);
    main(outerIframe.contentWindow, allowedLogicUrlPrefixesJoined);
    const innerIframe =
      outerIframe.contentWindow.document.querySelector("iframe");
    assertToBeTruthy(innerIframe);
    const expectedRect = {
      left: 0,
      x: 0,
      top: 0,
      y: 0,
      right: 123,
      width: 123,
      bottom: 45,
      height: 45,
    };
    expect(innerIframe.getBoundingClientRect().toJSON()).toEqual(expectedRect);
    const rectsInViewport = await new Promise<IntersectionObserverEntry[]>(
      (resolve) => {
        new IntersectionObserver(resolve).observe(innerIframe);
      }
    );
    expect(rectsInViewport).toHaveSize(1);
    expect(rectsInViewport[0].boundingClientRect.toJSON()).toEqual(
      expectedRect
    );
    expect(getComputedStyle(innerIframe).borderRadius).toEqual("0px");
    expect(getComputedStyle(innerIframe).borderStyle).toEqual("none");
    // There's no other way to check this as far as we know.
    expect(innerIframe.scrolling).toEqual("no");
  });

  it("should log an error on invalid token", () => {
    const consoleSpy = spyOnAllFunctions(console);
    const iframe = document.createElement("iframe");
    iframe.src = "about:blank#" + token;
    document.body.appendChild(iframe);
    const win = iframe.contentWindow;
    assertToBeTruthy(win);
    main(win, allowedLogicUrlPrefixesJoined);
    expect(consoleSpy.error).toHaveBeenCalledOnceWith(
      jasmine.any(String),
      "#" + token
    );
  });

  it("should log an error if running on top window", () => {
    const consoleSpy = spyOnAllFunctions(console);
    main(top, allowedLogicUrlPrefixesJoined);
    expect(consoleSpy.error).toHaveBeenCalledOnceWith(jasmine.any(String));
  });

  it("should log an error if allowlisted logic URL prefix is not a valid absolute URL", () => {
    const consoleSpy = spyOnAllFunctions(console);
    main(window, "/relative/");
    expect(consoleSpy.error).toHaveBeenCalledOnceWith(
      jasmine.any(String),
      "/relative/"
    );
  });

  it("should log an error if allowlisted logic URL prefix does not end with a slash", () => {
    const consoleSpy = spyOnAllFunctions(console);
    main(window, "https://dsp.test");
    expect(consoleSpy.error).toHaveBeenCalledOnceWith(
      jasmine.any(String),
      "https://dsp.test"
    );
  });

  it("should log an error if allowlisted logic URL prefix is insecure HTTP", () => {
    const consoleSpy = spyOnAllFunctions(console);
    main(window, "http://insecure-dsp.test/");
    expect(consoleSpy.error).toHaveBeenCalledOnceWith(
      jasmine.any(String),
      "http://insecure-dsp.test/"
    );
  });
});
