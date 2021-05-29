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
import { awaitMessageToPort } from "../lib/shared/messaging";

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
