/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/** @fileoverview Selection of ads, and creation of tokens to display them. */

import * as uuid from "uuid";
import { getAllAds } from "./database";

/**
 * Selects the currently stored ad with the highest price, mints a token that
 * can later be used to display that ad (by storing the mapping in
 * `sessionStorage`), and returns the token. If no ads are available, returns
 * `null`.
 */
export async function runAdAuction(): Promise<string | null> {
  const ads = await getAllAds();
  const firstAdResult = ads.next();
  if (firstAdResult.done) {
    return null;
  }
  let [winningRenderingUrl, winningPrice] = firstAdResult.value;
  for (const [renderingUrl, price] of ads) {
    if (price > winningPrice) {
      winningRenderingUrl = renderingUrl;
      winningPrice = price;
    }
  }
  const token = uuid.v4();
  sessionStorage.setItem(token, winningRenderingUrl);
  return token;
}
