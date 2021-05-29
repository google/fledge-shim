/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview The library's end of the handshake protocol that initially
 * establishes communication between the library and the frame. The
 * corresponding code for the frame is in `frame/main.ts`.
 */

import { isObject } from "./shared/guards";
import { awaitMessageFromIframeToSelf } from "./shared/messaging";
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
    throw new Error("Message deserialization error");
  }
  const { data, ports, origin } = event;
  if (origin !== expectedOrigin) {
    throw new Error(
      `Origin mismatch during handshake: expected ${expectedOrigin}, but received ${origin}`
    );
  }
  if (!isObject(data) || data[VERSION_KEY] !== VERSION) {
    throw new Error(
      `Version mismatch during handshake: expected ${JSON.stringify({
        [VERSION_KEY]: VERSION,
      })}, but received ${JSON.stringify(data)}`
    );
  }
  if (ports.length !== 1) {
    throw new Error(
      `Port transfer mismatch during handshake: expected 1 port, but received ${ports.length}`
    );
  }
  return ports[0];
}
