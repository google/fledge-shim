/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import "jasmine";
import { assertToBeTruthy } from "../../testing/assert";
import { cleanDomAfterEach } from "../../testing/dom";
import {
  addMessagePortMatchers,
  iframeSendingPostMessageErrorToParent,
  portReceivingMessageError,
  postMessageFromIframeToSelf,
} from "../../testing/messaging";
import {
  awaitMessageFromIframeToSelf,
  awaitMessageFromSelfToSelf,
  awaitMessageToPort,
} from "./messaging";

describe("messaging:", () => {
  beforeAll(addMessagePortMatchers);

  describe("awaitMessageFromIframeToSelf", () => {
    cleanDomAfterEach();

    it("should receive a message", async () => {
      const iframe = document.createElement("iframe");
      document.body.appendChild(iframe);
      const messageEventPromise = awaitMessageFromIframeToSelf(iframe);
      const payload = crypto.getRandomValues(new Int32Array(1))[0];
      const { port1, port2 } = new MessageChannel();
      postMessageFromIframeToSelf(iframe, payload, [port1]);
      const messageEvent = await messageEventPromise;
      assertToBeTruthy(messageEvent);
      const { data, origin, ports, source } = messageEvent;
      expect(data).toBe(payload);
      expect(origin).toBe(window.origin);
      expect(ports).toHaveSize(1);
      await expectAsync(ports[0]).toBeEntangledWith(port2);
      expect(source).toBe(iframe.contentWindow);
    });

    it("should ignore messages from other windows", async () => {
      const iframe = document.createElement("iframe");
      document.body.appendChild(iframe);
      const otherIframe = document.createElement("iframe");
      document.body.appendChild(otherIframe);
      const messageEventPromise = awaitMessageFromIframeToSelf(iframe);
      postMessageFromIframeToSelf(otherIframe, "wrong payload", []);
      await expectAsync(messageEventPromise).toBePending();
      postMessageFromIframeToSelf(iframe, "right payload", []);
      await messageEventPromise;
    });

    it("should return null on message error", async () => {
      const iframe = iframeSendingPostMessageErrorToParent();
      const messageEventPromise = awaitMessageFromIframeToSelf(iframe);
      document.body.appendChild(iframe);
      expect(await messageEventPromise).toBeNull();
    });

    it("should ignore message errors from other windows", async () => {
      const iframe = document.createElement("iframe");
      document.body.appendChild(iframe);
      const messageEventPromise = awaitMessageFromIframeToSelf(iframe);
      document.body.appendChild(iframeSendingPostMessageErrorToParent());
      await expectAsync(messageEventPromise).toBePending();
      postMessageFromIframeToSelf(iframe, "payload", []);
      await messageEventPromise;
    });
  });

  describe("awaitMessageFromSelfToSelf", () => {
    cleanDomAfterEach();

    it("should receive a message", async () => {
      const messageEventPromise = awaitMessageFromSelfToSelf();
      const payload = crypto.getRandomValues(new Int32Array(1))[0];
      const { port1, port2 } = new MessageChannel();
      postMessage(payload, window.origin, [port1]);
      const messageEvent = await messageEventPromise;
      assertToBeTruthy(messageEvent);
      const { data, origin, ports, source } = messageEvent;
      expect(data).toBe(payload);
      expect(origin).toBe(window.origin);
      expect(ports).toHaveSize(1);
      await expectAsync(ports[0]).toBeEntangledWith(port2);
      expect(source).toBe(window);
    });

    it("should ignore messages from other windows", async () => {
      const iframe = document.createElement("iframe");
      document.body.appendChild(iframe);
      const messageEventPromise = awaitMessageFromSelfToSelf();
      postMessageFromIframeToSelf(iframe, "wrong payload", []);
      await expectAsync(messageEventPromise).toBePending();
      postMessage("right payload", origin, []);
      await messageEventPromise;
    });
  });

  describe("awaitMessageToPort", () => {
    it("should receive a message", async () => {
      const { port1: receiver, port2: sender } = new MessageChannel();
      const messageEventPromise = awaitMessageToPort(receiver);
      const payload = crypto.getRandomValues(new Int32Array(1))[0];
      const { port1, port2 } = new MessageChannel();
      sender.postMessage(payload, [port1]);
      const messageEvent = await messageEventPromise;
      assertToBeTruthy(messageEvent);
      const { data, ports } = messageEvent;
      expect(data).toBe(payload);
      expect(ports).toHaveSize(1);
      await expectAsync(ports[0]).toBeEntangledWith(port2);
    });

    it("should return null on message error", async () => {
      expect(
        await awaitMessageToPort(await portReceivingMessageError())
      ).toBeNull();
    });

    it("should close the port", async () => {
      const { port1: receiver, port2: sender } = new MessageChannel();
      const messageEventPromise = awaitMessageToPort(receiver);
      sender.postMessage(null);
      await messageEventPromise;
      await expectAsync(receiver).not.toBeEntangledWith(sender);
    });
  });
});
