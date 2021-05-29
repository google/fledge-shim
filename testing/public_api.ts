/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Utility functions used only in test code, that facilitate
 * testing of the FledgeShim public API with proper cleanup.
 */

import "jasmine";
import { FledgeShim } from "../lib/public_api";
import { assertToBeTruthy } from "./assert";

let fledgeShims: FledgeShim[] = [];

/**
 * Returns a newly constructed FledgeShim using a frame served from Karma, that
 * will be destroyed after the current test.
 */
export function create(): FledgeShim {
  const fledgeShim = new FledgeShim("/frame.html");
  fledgeShims.push(fledgeShim);
  return fledgeShim;
}

afterEach(() => {
  for (const fledgeShim of fledgeShims) {
    if (!fledgeShim.isDestroyed()) {
      fledgeShim.destroy();
    }
  }
  fledgeShims = [];
});

/**
 * Given a string returned from `runAdAuction`, returns the `renderUrl` of the
 * winning ad. Note that this is only possible because the frame served by Karma
 * is same-origin to the page where the tests run; browser-native
 * implementations will not allow this, nor is it possible in production with
 * the shim when using a frame on a different origin from the publisher page.
 */
export async function renderUrlFromAuctionResult(
  auctionResultUrl: string
): Promise<string> {
  const outerIframe = document.createElement("iframe");
  outerIframe.src = auctionResultUrl;
  const loadPromise = new Promise((resolve) => {
    outerIframe.addEventListener("load", resolve, { once: true });
  });
  document.body.appendChild(outerIframe);
  try {
    await loadPromise;
    assertToBeTruthy(outerIframe.contentDocument);
    const innerIframe = outerIframe.contentDocument.querySelector("iframe");
    assertToBeTruthy(innerIframe);
    return innerIframe.src;
  } finally {
    outerIframe.remove();
  }
}
