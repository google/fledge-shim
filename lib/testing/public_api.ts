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
import { nonNullish } from "../../lib/shared/types";
import { FledgeShim } from "../public_api";

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
 * Given a string returned from `runAdAuction`, returns the `rendering_url` of
 * the winning ad. Note that this is only possible because the frame served by
 * Karma is same-origin to the page where the tests run; browser-native
 * implementations will not allow this, nor is it possible in production with
 * the shim when using a frame on a different origin from the publisher page.
 */
export async function renderingUrlFromAuctionResult(
  auctionResultUrl: string
): Promise<string> {
  const iframe = document.createElement("iframe");
  iframe.src = auctionResultUrl;
  const loadPromise = new Promise((resolve) => {
    iframe.addEventListener("load", resolve, { once: true });
  });
  document.body.appendChild(iframe);
  try {
    await loadPromise;
    return nonNullish(
      nonNullish(iframe.contentDocument).querySelector("iframe")
    ).src;
  } finally {
    iframe.remove();
  }
}
