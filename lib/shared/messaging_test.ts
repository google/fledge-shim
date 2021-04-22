/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import "jasmine";
import { awaitMessageFromIframeToSelf, awaitMessageToPort } from "./messaging";
import { cleanDomAfterEach } from "./testing/dom";
import {
  addMessagePortMatchers,
  postMessageFromIframeToSelf,
} from "./testing/messaging";

describe("messaging:", () => {
  beforeAll(addMessagePortMatchers);

  describe("awaitMessageFromIframeToSelf", () => {
    cleanDomAfterEach();

    it("should receive a message", async () => {
      const iframe = document.createElement("iframe");
      document.body.appendChild(iframe);
      // Don't use awaitMessageFromIframeToSelf here because that function's own
      // unit tests depend on postMessageFromIframeToSelf.
      const messageEventPromise = awaitMessageFromIframeToSelf(iframe);
      const payload = crypto.getRandomValues(new Int32Array(1))[0];
      const { port1, port2 } = new MessageChannel();
      postMessageFromIframeToSelf(iframe, payload, [port1]);
      const { data, origin, ports, source } = await messageEventPromise;
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

    const POSTMESSAGE_SHAREDARRAYBUFFER_SRCDOC =
      "<!DOCTYPE html><title>Helper</title><script>parent.postMessage(new SharedArrayBuffer(), '*');</script>";

    it("should reject on message error", async () => {
      const iframe = document.createElement("iframe");
      iframe.srcdoc = POSTMESSAGE_SHAREDARRAYBUFFER_SRCDOC;
      iframe.sandbox.add("allow-scripts");
      const messageEventPromise = awaitMessageFromIframeToSelf(iframe);
      document.body.appendChild(iframe);
      await expectAsync(messageEventPromise).toBeRejectedWithError();
    });

    it("should ignore message errors from other windows", async () => {
      const iframe = document.createElement("iframe");
      document.body.appendChild(iframe);
      const messageEventPromise = awaitMessageFromIframeToSelf(iframe);
      const otherIframe = document.createElement("iframe");
      otherIframe.srcdoc = POSTMESSAGE_SHAREDARRAYBUFFER_SRCDOC;
      otherIframe.sandbox.add("allow-scripts");
      document.body.appendChild(otherIframe);
      await expectAsync(messageEventPromise).toBePending();
      postMessageFromIframeToSelf(iframe, "payload", []);
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
      const { data, ports } = await messageEventPromise;
      expect(data).toBe(payload);
      expect(ports).toHaveSize(1);
      await expectAsync(ports[0]).toBeEntangledWith(port2);
    });
  });
});
