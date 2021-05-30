/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Code that receives and parses messages from the frame to the
 * library.
 */

import { isObject } from "./shared/guards";
import {
  awaitMessageFromIframeToSelf,
  awaitMessageToPort,
} from "./shared/messaging";
import { isRunAdAuctionResponse } from "./shared/protocol";
import { VERSION, VERSION_KEY } from "./shared/version";

/**
 * Waits for a handshake message from the given iframe that establishes a
 * messaging channel with it. Ensures that the two sides are running the same
 * version of the messaging protocol, to avoid surprise compatibility problems
 * later.
 *
 * This need be called only once after creating an iframe; subsequent
 * communication can occur over the returned `MessagePort`, eliminating the need
 * disambiguate the sources of those messages at runtime.
 *
 * @param iframe An iframe whose content will initiate the handshake by sending
 * a message (in production, with `connect` from `frame/main.ts`) to this
 * window. This iframe should not yet be attached to the document when this
 * function is called; this ensures that the message won't be sent until after
 * the listener is attached, and so won't be missed.
 * @param expectedOrigin `iframe`'s origin.
 * @return A `MessagePort` that was transferred from `iframe`'s content window
 * to the current window as part of the handshake message.
 */
export async function awaitConnectionFromIframe(
  iframe: HTMLIFrameElement,
  expectedOrigin: string
): Promise<MessagePort> {
  const event = await awaitMessageFromIframeToSelf(iframe);
  if (!event) {
    throw new Error(DESERIALIZATION_ERROR_MESSAGE);
  }
  const { data, ports, origin } = event;
  if (origin !== expectedOrigin) {
    throw new Error(
      `Origin mismatch during handshake: Expected ${expectedOrigin}, but received ${origin}`
    );
  }
  if (!isObject(data) || data[VERSION_KEY] !== VERSION) {
    const error: Partial<ErrorWithData> = new Error(
      `Version mismatch during handshake: Expected ${JSON.stringify({
        [VERSION_KEY]: VERSION,
      })}`
    );
    error.data = data;
    throw error;
  }
  if (ports.length !== 1) {
    throw new Error(
      `Port transfer mismatch during handshake: Expected 1 port, but received ${ports.length}`
    );
  }
  return ports[0];
}

/**
 * Returns a promise that waits for the first `RunAdAuctionResponse` sent to
 * `port`, which is activated if it hasn't been already. The promise resolves to
 * the token if there is one, resolves to null if the auction had no winner, or
 * rejects if any kind of error or unexpected condition occurs.
 */
export async function awaitRunAdAuctionResponseToPort(
  port: MessagePort
): Promise<string | null> {
  const event = await awaitMessageToPort(port);
  if (!event) {
    throw new Error(DESERIALIZATION_ERROR_MESSAGE);
  }
  const { data, ports } = event;
  // Normally there shouldn't be any ports here, but in case a bogus frame sent
  // some, we close them to avoid memory leaks.
  for (const port of ports) {
    port.close();
  }
  if (!isRunAdAuctionResponse(data)) {
    const error: Partial<ErrorWithData> = new Error(
      "Malformed response: Expected RunAdAuctionResponse"
    );
    error.data = data;
    throw error;
  }
  switch (data) {
    case true:
      return null;
    case false:
      throw new Error("Error occurred in frame; see console for details");
    default:
      return data;
  }
}

const DESERIALIZATION_ERROR_MESSAGE = "Message deserialization error";

/**
 * An error with additional associated data. This exists solely to facilitate
 * debugging by callers of errors stemming from bad data coming from the frame.
 * If you encounter such an error, you probably passed a bad value for
 * `frameSrc`, or the party that is hosting the frame at that URL set it up
 * incorrectly.
 */
export interface ErrorWithData extends Error {
  /** The bad data passed from the frame. */
  data: unknown;
}
