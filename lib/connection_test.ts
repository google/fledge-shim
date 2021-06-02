/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import "jasmine";
import { assertToBeInstanceOf } from "../testing/assert";
import { cleanDomAfterEach } from "../testing/dom";
import {
  addMessagePortMatchers,
  iframeSendingPostMessageErrorToParent,
  portReceivingMessageError,
  postMessageFromIframeToSelf,
} from "../testing/messaging";
import {
  awaitConnectionFromIframe,
  awaitRunAdAuctionResponseToPort,
  ErrorWithData,
} from "./connection";
import { RunAdAuctionResponse } from "./shared/protocol";
import { VERSION, VERSION_KEY } from "./shared/version";

describe("awaitConnectionFromIframe", () => {
  cleanDomAfterEach();
  beforeAll(addMessagePortMatchers);

  it("should perform the handshake and transfer a connected port", async () => {
    const iframe = document.createElement("iframe");
    document.body.appendChild(iframe);
    const portPromise = awaitConnectionFromIframe(iframe, origin);
    const { port1, port2 } = new MessageChannel();
    postMessageFromIframeToSelf(iframe, { [VERSION_KEY]: VERSION }, [port1]);
    await expectAsync(await portPromise).toBeEntangledWith(port2);
  });

  it("should reject on origin mismatch", async () => {
    const iframe = document.createElement("iframe");
    document.body.appendChild(iframe);
    const portPromise = awaitConnectionFromIframe(
      iframe,
      "https://wrong-origin.example"
    );
    postMessageFromIframeToSelf(iframe, { [VERSION_KEY]: VERSION }, [
      new MessageChannel().port1,
    ]);
    const error = await portPromise.then(fail, (error: unknown) => error);
    assertToBeInstanceOf(error, Error);
    expect(error.message).toContain("https://wrong-origin.example");
    expect(error.message).toContain(origin);
  });

  it("should reject on nullish handshake message", async () => {
    const iframe = document.createElement("iframe");
    document.body.appendChild(iframe);
    const portPromise = awaitConnectionFromIframe(iframe, origin);
    postMessageFromIframeToSelf(iframe, null, [new MessageChannel().port1]);
    const error = await portPromise.then(fail, (error: unknown) => error);
    assertToBeInstanceOf(error, Error);
    const errorWithData: Partial<ErrorWithData> = error;
    expect(errorWithData.data).toBeNull();
  });

  it("should reject on wrong version", async () => {
    const iframe = document.createElement("iframe");
    document.body.appendChild(iframe);
    const portPromise = awaitConnectionFromIframe(iframe, origin);
    postMessageFromIframeToSelf(iframe, { [VERSION_KEY]: "wrong version" }, [
      new MessageChannel().port1,
    ]);
    const error = await portPromise.then(fail, (error: unknown) => error);
    assertToBeInstanceOf(error, Error);
    const errorWithData: Partial<ErrorWithData> = error;
    expect(errorWithData.data).toEqual({ [VERSION_KEY]: "wrong version" });
  });

  it("should reject on wrong number of ports", async () => {
    const iframe = document.createElement("iframe");
    document.body.appendChild(iframe);
    const portPromise = awaitConnectionFromIframe(iframe, origin);
    postMessageFromIframeToSelf(iframe, { [VERSION_KEY]: VERSION }, []);
    await expectAsync(portPromise).toBeRejectedWithError(/.*\b0\b.*/);
  });

  it("should reject on message error", async () => {
    const iframe = iframeSendingPostMessageErrorToParent();
    document.body.appendChild(iframe);
    await expectAsync(
      awaitConnectionFromIframe(iframe, "null")
    ).toBeRejectedWithError();
  });
});

describe("awaitRunAdAuctionResponseToPort", () => {
  it("should receive a token", async () => {
    const { port1: receiver, port2: sender } = new MessageChannel();
    const tokenPromise = awaitRunAdAuctionResponseToPort(receiver);
    const token: RunAdAuctionResponse = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    sender.postMessage(token);
    expect(await tokenPromise).toBe(token);
  });

  it("should receive a no-winner response", async () => {
    const { port1: receiver, port2: sender } = new MessageChannel();
    const tokenPromise = awaitRunAdAuctionResponseToPort(receiver);
    const response: RunAdAuctionResponse = true;
    sender.postMessage(response);
    expect(await tokenPromise).toBeNull();
  });

  it("should reject on error response", async () => {
    const { port1: receiver, port2: sender } = new MessageChannel();
    const tokenPromise = awaitRunAdAuctionResponseToPort(receiver);
    const response: RunAdAuctionResponse = false;
    sender.postMessage(response);
    await expectAsync(tokenPromise).toBeRejectedWithError();
  });

  it("should reject on malformed response", async () => {
    const { port1: receiver, port2: sender } = new MessageChannel();
    const tokenPromise = awaitRunAdAuctionResponseToPort(receiver);
    const payload = new Date();
    sender.postMessage(payload, [new MessageChannel().port1]);
    const error = await tokenPromise.then(fail, (error: unknown) => error);
    assertToBeInstanceOf(error, Error);
    const errorWithData: Partial<ErrorWithData> = error;
    expect(errorWithData.data).toEqual(payload);
  });

  it("should reject on message error", async () => {
    await expectAsync(
      awaitRunAdAuctionResponseToPort(await portReceivingMessageError())
    ).toBeRejectedWithError();
  });
});
