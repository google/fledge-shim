/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/** @fileoverview Selection of ads, and creation of tokens to display them. */

import { isKeyValueObject } from "../lib/shared/types";
import { logWarning } from "./console";
import { getAllAds } from "./db_schema";
import { FetchJsonStatus, tryFetchJson } from "./fetch";

/**
 * Selects the currently stored ad with the highest price, mints a token that
 * can later be used to display that ad (by storing the mapping in
 * `sessionStorage`), and returns the token. If no ads are available, returns
 * `null`.
 *
 * Also makes a request to `trustedScoringSignalsUrl`, if one is provided, and
 * validates that it is a JSON object. For now, the data is simply thrown away
 * after that initial validation, because the simple scoring algorithm currently
 * used has no use for scoring signals, but when more algorithms are supported,
 * this data will be passed to them.
 *
 * @param hostname The hostname of the page where the FLEDGE Shim API is
 * running.
 */
export async function runAdAuction(
  trustedScoringSignalsUrl: string | null,
  hostname: string
): Promise<string | null> {
  const ads = await getAllAds();
  const firstAdResult = ads.next();
  if (firstAdResult.done) {
    return null;
  }
  let [winningRenderingUrl, winningPrice] = firstAdResult.value;
  const renderingUrls = new Set([winningRenderingUrl]);
  for (const [renderingUrl, price] of ads) {
    renderingUrls.add(renderingUrl);
    if (price > winningPrice) {
      winningRenderingUrl = renderingUrl;
      winningPrice = price;
    }
  }
  if (trustedScoringSignalsUrl !== null) {
    await fetchAndValidateTrustedScoringSignals(
      trustedScoringSignalsUrl,
      hostname,
      renderingUrls
    );
  }
  const token = randomToken();
  sessionStorage.setItem(token, winningRenderingUrl);
  return token;
}

function randomToken() {
  return Array.prototype.map
    .call(crypto.getRandomValues(new Uint8Array(16)), (byte: number) =>
      byte.toString(/* radix= */ 16).padStart(2, "0")
    )
    .join("");
}

async function fetchAndValidateTrustedScoringSignals(
  baseUrl: string,
  hostname: string,
  renderingUrls: ReadonlySet<string>
) {
  const url = new URL(baseUrl);
  url.searchParams.append("hostname", hostname);
  url.searchParams.append(
    "keys",
    [...renderingUrls].map(encodeURIComponent).join(",")
  );
  const response = await tryFetchJson(url.href);
  const basicErrorMessage = "Cannot use trusted scoring signals from";
  switch (response.status) {
    case FetchJsonStatus.OK: {
      const signals = response.value;
      if (!isKeyValueObject(signals)) {
        logWarning(basicErrorMessage, [
          url.href,
          ": Expected JSON object but received:",
          signals,
        ]);
      }
      return;
    }
    case FetchJsonStatus.NETWORK_ERROR:
      // Browser will have logged the error; no need to log it again.
      return;
    case FetchJsonStatus.VALIDATION_ERROR:
      logWarning(basicErrorMessage, [
        url.href,
        ": " + response.errorMessage,
        ...(response.errorData ?? []),
      ]);
      return;
  }
}
