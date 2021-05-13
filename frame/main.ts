/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview The logic immediately called by the entry-point file, factored
 * out into a separate file for testing purposes.
 */

import { VERSION, VERSION_KEY } from "../lib/shared/version";
import { handleRequest } from "./handler";

/**
 * Runs the frame code.
 *
 * @param win The window whose parent the handshake message is sent to or that
 * the ad is rendered into. This window's location fragment is used to decide
 * what to do. In production, this is always the global `window` object; a
 * friendly iframe may be used in unit tests.
 */
export function main(win: Window): void {
  const parentOrigin = win.location.ancestorOrigins[0];
  if (parentOrigin === undefined) {
    throw new Error("Frame can't run as a top-level document");
  }
  const fragment = win.location.hash;
  if (fragment) {
    render(win.document, fragment);
  } else {
    connect(win.parent, parentOrigin);
  }
}

function connect(targetWindow: Window, targetOrigin: string) {
  const { port1: receiver, port2: sender } = new MessageChannel();
  const { hostname } = new URL(targetOrigin);
  receiver.onmessage = (event: MessageEvent<unknown>) => {
    void handleRequest(event, hostname);
  };
  targetWindow.postMessage({ [VERSION_KEY]: VERSION }, targetOrigin, [sender]);
}

function render(doc: Document, fragment: string) {
  const token = fragment.substring(1);
  const renderingUrl = sessionStorage.getItem(token);
  if (!renderingUrl) {
    throw new Error(`Invalid token: ${token}`);
  }
  const iframe = doc.createElement("iframe");
  iframe.src = renderingUrl;
  iframe.scrolling = "no";
  iframe.style.border = "none";
  iframe.style.width =
    iframe.style.height =
    doc.body.style.height =
    doc.documentElement.style.height =
      "100%";
  doc.body.style.margin = "0";
  doc.body.appendChild(iframe);
}
