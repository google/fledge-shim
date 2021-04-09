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
import { errorMessage } from "./error";
import { handleRequest } from "./handler";

/**
 * Runs the frame code.
 *
 * @param win TODO
 * @param callbackForTesting TODO
 */
export function main(
  win: Window,
  callbackForTesting: () => void = () => {
    // Do nothing
  }
): void {
  const parentOrigin = win.location.ancestorOrigins[0];
  if (parentOrigin === undefined) {
    throw new Error("Frame can't run as a top-level document");
  }
  const fragment = win.location.hash;
  if (fragment) {
    render(win.document, fragment);
  } else {
    connect(win.parent, parentOrigin, callbackForTesting);
  }
}

function connect(
  targetWindow: Window,
  targetOrigin: string,
  callbackForTesting: () => void
) {
  try {
    callbackForTesting();
    const { port1: receiver, port2: sender } = new MessageChannel();
    receiver.onmessage = handleRequest;
    targetWindow.postMessage({ [VERSION_KEY]: VERSION }, targetOrigin, [
      sender,
    ]);
  } catch (error: unknown) {
    targetWindow.postMessage(errorMessage(error), targetOrigin);
  }
}

function render(doc: Document, fragment: string) {
  const token = fragment.substring(1);
  const renderingUrl = sessionStorage.getItem(token);
  if (!renderingUrl) {
    throw new Error(`Invalid token: ${token}`);
  }
  const iframe = doc.createElement("iframe");
  iframe.src = renderingUrl;
  doc.body.appendChild(iframe);
}
