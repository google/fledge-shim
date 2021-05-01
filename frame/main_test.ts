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
  FledgeRequest,
  RequestTag,
  isRunAdAuctionResponse,
} from "../lib/shared/protocol";
import { assert, assertType, nonNullish } from "../lib/shared/types";
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
    main(nonNullish(iframe.contentWindow));
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
    assertType(auctionResponse, isRunAdAuctionResponse);
    assert(auctionResponse[0]);
    expect(sessionStorage.getItem(nonNullish(auctionResponse[1]))).toBe(
      renderingUrl
    );
  });

  const token = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

  it("should render an ad", () => {
    sessionStorage.setItem(token, renderingUrl);
    const iframe = document.createElement("iframe");
    iframe.src = "about:blank#" + token;
    document.body.appendChild(iframe);
    assert(iframe.contentWindow !== null);
    main(iframe.contentWindow);
    expect(
      nonNullish(iframe.contentWindow.document.querySelector("iframe")).src
    ).toBe(renderingUrl);
  });

  it("should render with the exact same dimensions as the outer iframe, with no borders or scrollbars", async () => {
    sessionStorage.setItem(token, renderingUrl);
    const outerIframe = document.createElement("iframe");
    outerIframe.src = "about:blank#" + token;
    outerIframe.style.width = "123px";
    outerIframe.style.height = "45px";
    document.body.appendChild(outerIframe);
    assert(outerIframe.contentWindow !== null);
    main(outerIframe.contentWindow);
    const innerIframe = nonNullish(
      outerIframe.contentWindow.document.querySelector("iframe")
    );
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

  it("should throw on invalid token", () => {
    const iframe = document.createElement("iframe");
    iframe.src = "about:blank#" + token;
    document.body.appendChild(iframe);
    const win = nonNullish(iframe.contentWindow);
    assert(iframe.contentWindow !== null);
    expect(() => {
      main(win);
    }).toThrowError();
  });

  it("should throw if running on top window", () => {
    expect(() => {
      main(top);
    }).toThrowError();
  });
});
