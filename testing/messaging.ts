/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Utility functions used only in test code, that facilitate
 * testing of `postMessage`-related code.
 */

import "jasmine";
import {
  awaitMessageFromIframeToSelf,
  awaitMessageToPort,
} from "../lib/shared/messaging";
import { assertToBeTruthy } from "./assert";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jasmine {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface AsyncMatchers<T, U> {
      /**
       * Expect the actual value to be a `MessagePort` entangled with the
       * expected value, i.e., they came from the same `MessageChannel`
       * (possibly indirectly via `postMessage` transfers).
       *
       * This is checked by sending a message into `expected` and receiving it
       * out of `actual`.
       */
      toBeEntangledWith(
        this: jasmine.AsyncMatchers<MessagePort, unknown>,
        expected: MessagePort
      ): Promise<void>;
    }
  }
}

/**
 * Must be passed to `beforeAll` in each suite that uses `toBeEntangledWith`.
 */
export function addMessagePortMatchers(): void {
  jasmine.addAsyncMatchers({
    toBeEntangledWith: () => ({
      async compare(actual: MessagePort, expected: MessagePort) {
        const messageEventPromise = awaitMessageToPort(actual);
        const payload = crypto.getRandomValues(new Int32Array(1))[0];
        expected.postMessage(payload);
        return {
          pass: await Promise.race([
            messageEventPromise.then(
              (event) => event !== null && event.data === payload
            ),
            new Promise<false>((resolve) => {
              setTimeout(() => {
                resolve(false);
              }, 0);
            }),
          ]),
        };
      },
    }),
  });
}

/**
 * Sends a message via `postMessage` from `iframe`'s content window to the
 * current window. The `MessageEvent` is dispatched to the current window, and
 * its `source` property is `iframe.contentWindow`.
 */
export function postMessageFromIframeToSelf(
  iframe: HTMLIFrameElement,
  message: unknown,
  transfer: Transferable[]
): void {
  const iframeWin = iframe.contentWindow;
  if (!iframeWin) {
    throw new Error("iframe has no content document");
  }
  const iframeDoc = iframeWin.document;
  const script = iframeDoc.createElement("script");
  script.textContent =
    "postMessageTo = (win, message, targetOrigin, transfer) => { win.postMessage(message, targetOrigin, transfer); }";
  iframeDoc.body.appendChild(script);
  try {
    script.remove();
    (iframeWin as unknown as WithPostMessageTo).postMessageTo(
      window,
      message,
      origin,
      transfer
    );
  } finally {
    delete (iframeWin as Partial<WithPostMessageTo>).postMessageTo;
  }
}

declare interface WithPostMessageTo {
  postMessageTo(
    win: Window,
    message: unknown,
    targetOrigin: string,
    transfer: Transferable[]
  ): void;
}

// Deliberately triggering a messageerror from test code is surprisingly tricky.
// One thing that does it is attempting to send a WebAssembly module to a
// different agent cluster; see
// https://html.spec.whatwg.org/multipage/origin.html#origin-keyed-agent-clusters.
// Sandboxing an iframe without allow-same-origin puts it in a different agent
// cluster. The inline bytes are the binary encoding of the smallest legal
// WebAssembly module; see
// https://webassembly.github.io/spec/core/binary/modules.html#binary-module.

/**
 * Returns an iframe that, when attached to a document, sends a
 * non-deserializable message via `postMessage` to that document's window,
 * causing the `messageerror` event listener to fire on that window.
 */
export function iframeSendingPostMessageErrorToParent(): HTMLIFrameElement {
  const iframe = document.createElement("iframe");
  iframe.srcdoc =
    "<!DOCTYPE html><title>Helper</title><script>parent.postMessage(new WebAssembly.Module(Uint8Array.of(0x00, 0x61, 0x73, 0x6D, 0x01, 0x00, 0x00, 0x00)), '*');</script>";
  iframe.sandbox.add("allow-scripts");
  return iframe;
}

/**
 * Returns a `MessagePort` that, in a task immediately following the current
 * one, receives a `messageerror` event. The caller must attach the event
 * listener to the port in the same task after calling this function, or else
 * the event will be missed.
 */
export async function portReceivingMessageError(): Promise<MessagePort> {
  const iframe = document.createElement("iframe");
  iframe.srcdoc =
    "<!DOCTYPE html><title>Helper</title><script>const { port1, port2 } = new MessageChannel(); parent.postMessage(null, '*', [port1]); port2.postMessage(new WebAssembly.Module(Uint8Array.of(0x00, 0x61, 0x73, 0x6D, 0x01, 0x00, 0x00, 0x00)));</script>";
  iframe.sandbox.add("allow-scripts");
  const windowMessageEventPromise = awaitMessageFromIframeToSelf(iframe);
  document.body.appendChild(iframe);
  try {
    const windowMessageEvent = await windowMessageEventPromise;
    assertToBeTruthy(windowMessageEvent);
    expect(windowMessageEvent.data).toBeNull();
    expect(windowMessageEvent.origin).toBe("null");
    expect(windowMessageEvent.ports).toHaveSize(1);
    return windowMessageEvent.ports[0];
  } finally {
    iframe.remove();
  }
}
