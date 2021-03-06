/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import "jasmine";
import { assertToBeInstanceOf, assertToBeTruthy } from "./assert";
import { cleanDomAfterEach } from "./dom";
import {
  addMessagePortMatchers,
  iframeSendingPostMessageErrorToParent,
  portReceivingMessageError,
  postMessageFromIframeToSelf,
} from "./messaging";

describe("testing/messaging:", () => {
  beforeAll(addMessagePortMatchers);

  describe("toBeEntangledWith", () => {
    it("should match two entangled ports", () => {
      const { port1, port2 } = new MessageChannel();
      return expectAsync(port1).toBeEntangledWith(port2);
    });

    it("should not match two non-entangled ports", () => {
      return expectAsync(new MessageChannel().port1).not.toBeEntangledWith(
        new MessageChannel().port1
      );
    });
  });

  describe("postMessageFromIframeToSelf", () => {
    cleanDomAfterEach();

    it("should send a message", async () => {
      const iframe = document.createElement("iframe");
      document.body.appendChild(iframe);
      // Don't use awaitMessageFromIframeToSelf here because that function's own
      // unit tests depend on postMessageFromIframeToSelf.
      const messageEventPromise = new Promise<MessageEvent<unknown>>(
        (resolve) => {
          addEventListener("message", resolve, { once: true });
        }
      );
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

    it("should clean up after itself", () => {
      const iframe = document.createElement("iframe");
      document.body.appendChild(iframe);
      assertToBeTruthy(iframe.contentWindow);
      const iframeWindowProps = Object.getOwnPropertyNames(
        iframe.contentWindow
      );
      postMessageFromIframeToSelf(iframe, "payload", []);
      expect(iframe.contentWindow.document.body.childNodes).toHaveSize(0);
      expect(Object.getOwnPropertyNames(iframe.contentWindow)).toEqual(
        iframeWindowProps
      );
    });

    it("should throw if iframe has no content window", () => {
      const iframe = document.createElement("iframe");
      expect(() => {
        postMessageFromIframeToSelf(iframe, "message payload", []);
      }).toThrowError();
    });
  });

  describe("iframeSendingPostMessageErrorToParent", () => {
    cleanDomAfterEach();

    it("should cause a deserialization failure on the current window", async () => {
      addEventListener("message", fail);
      try {
        await new Promise((resolve) => {
          addEventListener("messageerror", resolve, { once: true });
          document.body.appendChild(iframeSendingPostMessageErrorToParent());
        });
      } finally {
        removeEventListener("message", fail);
      }
    });
  });

  describe("portReceivingMessageError", () => {
    it("should cause a deserialization failure on the port", async () => {
      const port = await portReceivingMessageError();
      await new Promise((resolve, reject) => {
        port.onmessage = reject;
        port.onmessageerror = resolve;
      });
    });

    it("should clean up after itself", async () => {
      const existingDom = document.documentElement.cloneNode(/* deep= */ true);
      assertToBeInstanceOf(existingDom, HTMLHtmlElement);
      await portReceivingMessageError();
      expect(document.documentElement).toEqual(existingDom);
    });
  });
});
