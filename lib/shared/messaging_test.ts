/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import "jasmine";
import {
  awaitMessageFromIframeToSelf,
  awaitMessageFromSelfToSelf,
  awaitMessageToPort,
} from "./messaging";
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

    // Deliberately triggering a messageerror from test code is surprisingly
    // tricky. One thing that does it is attempting to send a WebAssembly
    // module to a different agent cluster; see
    // https://html.spec.whatwg.org/multipage/origin.html#origin-keyed-agent-clusters.
    // Sandboxing an iframe without allow-same-origin puts it in a different
    // agent cluster. The inline bytes are the binary encoding of the smallest
    // legal WebAssembly module; see
    // https://webassembly.github.io/spec/core/binary/modules.html#binary-module.
    const POSTMESSAGE_WASM_MODULE_SRCDOC =
      "<!DOCTYPE html><title>Helper</title><script>parent.postMessage(new WebAssembly.Module(Uint8Array.of(0x00, 0x61, 0x73, 0x6D, 0x01, 0x00, 0x00, 0x00)), '*');</script>";

    it("should reject on message error", async () => {
      const iframe = document.createElement("iframe");
      iframe.srcdoc = POSTMESSAGE_WASM_MODULE_SRCDOC;
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
      otherIframe.srcdoc = POSTMESSAGE_WASM_MODULE_SRCDOC;
      otherIframe.sandbox.add("allow-scripts");
      document.body.appendChild(otherIframe);
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
      const { data, origin, ports, source } = await messageEventPromise;
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
      const { data, ports } = await messageEventPromise;
      expect(data).toBe(payload);
      expect(ports).toHaveSize(1);
      await expectAsync(ports[0]).toBeEntangledWith(port2);
    });
  });
});
