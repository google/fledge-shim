/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/** @fileoverview Utility functions for dealing with `postMessage`. */

/**
 * Returns a promise that resolves to the first `MessageEvent` sent from
 * `iframe`'s content window to the current window, or to null if a
 * deserialization error occurs.
 */
export function awaitMessageFromIframeToSelf(
  iframe: HTMLIFrameElement
): Promise<MessageEvent<unknown> | null> {
  return awaitMessage(window, ({ source }) => source === iframe.contentWindow);
}

/**
 * Returns a promise that resolves to the first `MessageEvent` sent from the
 * current window to itself, or to null if a deserialization error occurs.
 */
export function awaitMessageFromSelfToSelf(): Promise<MessageEvent<unknown> | null> {
  return awaitMessage(window, ({ source }) => source === window);
}

/**
 * Returns a promise that resolves to the first `MessageEvent` sent to `port`,
 * which is activated if it hasn't been already, or to null if a deserialization
 * error occurs.
 */
export function awaitMessageToPort(
  port: MessagePort
): Promise<MessageEvent<unknown> | null> {
  const messageEventPromise = awaitMessage(port, () => true);
  port.start();
  return messageEventPromise;
}

function awaitMessage(
  target: MessageTarget,
  filter: (event: MessageEvent<unknown>) => boolean
) {
  return new Promise<MessageEvent<unknown> | null>((resolve) => {
    const messageListener = (event: MessageEvent<unknown>) => {
      if (filter(event)) {
        target.removeEventListener("message", messageListener);
        target.removeEventListener("messageerror", messageErrorListener);
        resolve(event);
      }
    };
    const messageErrorListener = (event: MessageEvent<unknown>) => {
      if (filter(event)) {
        target.removeEventListener("message", messageListener);
        target.removeEventListener("messageerror", messageErrorListener);
        resolve(null);
      }
    };
    target.addEventListener("message", messageListener);
    target.addEventListener("messageerror", messageErrorListener);
  });
}

declare interface MessageTarget {
  addEventListener(
    type: "message" | "messageerror",
    listener: (event: MessageEvent<unknown>) => void
  ): void;
  removeEventListener(
    type: "message" | "messageerror",
    listener: (event: MessageEvent<unknown>) => void
  ): void;
}
