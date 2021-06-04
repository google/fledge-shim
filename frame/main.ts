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
import { logError } from "./console";
import { handleRequest } from "./handler";

/**
 * Runs the frame code.
 *
 * @param win The window whose parent the handshake message is sent to or that
 * the ad is rendered into. This window's location fragment is used to decide
 * what to do. In production, this is always the global `window` object; a
 * friendly iframe may be used in unit tests.
 * @param allowedLogicUrlPrefixesJoined URL prefixes that worklet scripts are
 * to be sourced from, separated by commas.
 */
export function main(win: Window, allowedLogicUrlPrefixesJoined: string): void {
  const allowedLogicUrlPrefixes = allowedLogicUrlPrefixesJoined.split(",");
  for (const prefix of allowedLogicUrlPrefixes) {
    let url;
    try {
      url = new URL(prefix);
    } catch (error: unknown) {
      /* istanbul ignore else */
      if (error instanceof TypeError) {
        logError("Prefix must be a valid absolute URL:", [prefix]);
        return;
      } else {
        throw error;
      }
    }
    if (!prefix.endsWith("/")) {
      logError("Prefix must end with a slash:", [prefix]);
      return;
    }
    if (url.protocol !== "https:") {
      logError("Prefix must be HTTPS:", [prefix]);
      return;
    }
  }
  const parentOrigin = win.location.ancestorOrigins[0];
  if (parentOrigin === undefined) {
    logError("Frame can't run as a top-level document");
    return;
  }
  const fragment = win.location.hash;
  if (fragment) {
    render(win.document, fragment);
  } else {
    connect(win.parent, parentOrigin, allowedLogicUrlPrefixes);
  }
}

function connect(
  targetWindow: Window,
  targetOrigin: string,
  allowedLogicUrlPrefixes: readonly string[]
) {
  const { port1: receiver, port2: sender } = new MessageChannel();
  const { hostname } = new URL(targetOrigin);
  receiver.onmessage = (event: MessageEvent<unknown>) => {
    void handleRequest(event, hostname, allowedLogicUrlPrefixes);
  };
  targetWindow.postMessage({ [VERSION_KEY]: VERSION }, targetOrigin, [sender]);
}

function render(doc: Document, fragment: string) {
  const renderUrl = sessionStorage.getItem(fragment.substring(1));
  if (!renderUrl) {
    logError("Invalid token:", [fragment]);
    return;
  }
  const iframe = doc.createElement("iframe");
  iframe.src = renderUrl;
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
