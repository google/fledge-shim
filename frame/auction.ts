/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/** @fileoverview Selection of ads, and creation of tokens to display them. */

import { Ad, AuctionAdConfig } from "../lib/shared/api_types";
import { isKeyValueObject } from "../lib/shared/guards";
import { logWarning } from "./console";
import { forEachInterestGroup } from "./db_schema";
import { FetchJsonStatus, tryFetchJson } from "./fetch";

/**
 * Selects the currently stored ad with the highest price, mints a token that
 * can later be used to display that ad (by storing the mapping in
 * `sessionStorage`), and returns the token. If no ads are available, returns
 * true. If an error occurs, returns false.
 *
 * Also makes a request to `trustedScoringSignalsUrl`, if one is provided, and
 * validates that it is a JSON object. For now, the data is simply thrown away
 * after that initial validation, because the simple scoring algorithm currently
 * used has no use for scoring signals, but when more algorithms are supported,
 * this data will be passed to them.
 *
 * The request's `keys` query parameter consists of all the ads' rendering URLs,
 * escaped and then joined with unescaped commas, ordered first alphabetically
 * by interest group name and then by the order given in the
 * `joinAdInterestGroup` call, with only the first kept in case of duplicates.
 * This leaks some information about interest groups and when they were joined
 * to the trusted server, but that's okay, since it's trusted.
 *
 * @param hostname The hostname of the page where the FLEDGE Shim API is
 * running.
 */
export async function runAdAuction(
  { trustedScoringSignalsUrl }: AuctionAdConfig,
  // This is temporary until trustedBiddingSignalsUrl is added.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  hostname: string
): Promise<string | boolean> {
  let winner: Ad | undefined;
  const renderingUrls = new Set<string>();
  if (
    !(await forEachInterestGroup(({ ads }) => {
      for (const ad of ads) {
        renderingUrls.add(ad.renderingUrl);
        if (!winner || ad.metadata.price > winner.metadata.price) {
          winner = ad;
        }
      }
    }))
  ) {
    return false;
  }
  if (!winner) {
    return true;
  }
  if (trustedScoringSignalsUrl !== undefined) {
    await fetchAndValidateTrustedSignals(
      trustedScoringSignalsUrl,
      `keys=${[...renderingUrls].map(encodeURIComponent).join(",")}`
    );
  }
  const token = randomToken();
  sessionStorage.setItem(token, winner.renderingUrl);
  return token;
}

function randomToken() {
  return Array.prototype.map
    .call(crypto.getRandomValues(new Uint8Array(16)), (byte: number) =>
      byte.toString(/* radix= */ 16).padStart(2, "0")
    )
    .join("");
}

async function fetchAndValidateTrustedSignals(
  baseUrl: string,
  queryString: string
) {
  let url;
  try {
    url = new URL(baseUrl);
  } catch (error: unknown) {
    if (error instanceof TypeError) {
      logWarning("Invalid URL:", [baseUrl]);
      return;
    }
    /* istanbul ignore next */
    throw error;
  }
  if (url.search) {
    logWarning("Query string not allowed in URL:", [baseUrl]);
    return;
  }
  url.search = queryString;
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
