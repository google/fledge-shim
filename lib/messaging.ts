/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/** @fileoverview TODO */

import { isObject } from "./shared/types";
import { VERSION, VERSION_KEY } from "./shared/version";

/**
 * TODO
 *
 * @param iframe TODO
 * @param win TODO
 * @param expectedOrigin TODO
 * @return TODO
 */
export function awaitConnectionFromIframe(
  iframe: HTMLIFrameElement,
  win: Window,
  expectedOrigin: string
): Promise<MessagePort> {
  return new Promise<MessagePort>((resolve, reject) => {
    const messageListener = ({
      data,
      ports,
      source,
      origin,
    }: MessageEvent<unknown>) => {
      if (source !== iframe.contentWindow) {
        return;
      }
      win.removeEventListener("message", messageListener);
      win.removeEventListener("messageerror", messageErrorListener);
      if (origin !== expectedOrigin) {
        reject(
          new Error(
            `Origin mismatch during handshake: expected ${expectedOrigin}, but received ${origin}`
          )
        );
        return;
      }
      if (!isObject(data) || data[VERSION_KEY] !== VERSION) {
        reject(
          new Error(
            `Version mismatch during handshake: expected {"${VERSION_KEY}":"${VERSION}"}, but received ${JSON.stringify(
              data
            )}`
          )
        );
        return;
      }
      if (ports.length !== 1) {
        reject(
          new Error(
            `Port transfer mismatch during handshake: expected 1 port, but received ${ports.length}`
          )
        );
        return;
      }
      resolve(ports[0]);
    };
    const messageErrorListener = ({ source }: MessageEvent<unknown>) => {
      if (source !== iframe.contentWindow) {
        return;
      }
      win.removeEventListener("message", messageListener);
      win.removeEventListener("messageerror", messageErrorListener);
      reject(new Error("Message deserialization error during handshake"));
    };
    win.addEventListener("message", messageListener);
    win.addEventListener("messageerror", messageErrorListener);
  });
}
