/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/** @fileoverview Selection of ads, and creation of tokens to display them. */

import { AuctionAdConfig } from "../lib/shared/api_types";
import { isKeyValueObject } from "../lib/shared/guards";
import { logWarning } from "./console";
import { forEachInterestGroup } from "./db_schema";
import { FetchStatus, tryFetchJavaScript, tryFetchJson } from "./fetch";
import { BidData, CanonicalInterestGroup } from "./types";
import { runBiddingScript } from "./worklet";

/**
 * Selects the currently stored ad with the highest price, mints a token that
 * can later be used to display that ad (by storing the mapping in
 * `sessionStorage`), and returns the token. If no ads are available, returns
 * true. If an error occurs, returns false.
 *
 * Also makes a request to each stored interest group's
 * `trustedBiddingSignalsUrl`, and to `trustedScoringSignalsUrl` if one is
 * provided, and validates that each response is a JSON object. For now, the
 * data is simply thrown away after that initial validation, because the simple
 * bidding and scoring algorithms currently used have no use for dynamic
 * signals, but when more algorithms are supported, this data will be passed to
 * them.
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
 * @param allowedLogicUrlPrefixes URL prefixes that worklet scripts are allowed
 * to be sourced from.
 * @param extraScript Additional JavaScript code to run in the Web Worker before
 * anything else. Used only in tests.
 */
export async function runAdAuction(
  { trustedScoringSignalsUrl }: AuctionAdConfig,
  hostname: string,
  allowedLogicUrlPrefixes: readonly string[],
  extraScript = ""
): Promise<string | boolean> {
  const trustedBiddingSignalsUrls = new Set<string>();
  const bidPromises: Array<Promise<BidData | null>> = [];
  if (
    !(await forEachInterestGroup((group: CanonicalInterestGroup) => {
      const { biddingLogicUrl, trustedBiddingSignalsUrl, ads } = group;
      if (biddingLogicUrl === undefined) {
        return;
      }
      if (
        !allowedLogicUrlPrefixes.some((prefix) =>
          biddingLogicUrl.startsWith(prefix)
        )
      ) {
        logWarning("biddingLogicUrl is not allowlisted:", [biddingLogicUrl]);
        return;
      }
      if (!ads.length) {
        return;
      }
      if (trustedBiddingSignalsUrl !== undefined) {
        trustedBiddingSignalsUrls.add(trustedBiddingSignalsUrl);
      }
      bidPromises.push(fetchScriptAndBid(biddingLogicUrl, group, extraScript));
    }))
  ) {
    return false;
  }
  let winner;
  const renderUrls = new Set<string>();
  for (const bidPromise of bidPromises) {
    const bidData = await bidPromise;
    if (!bidData) {
      continue;
    }
    renderUrls.add(bidData.render);
    if (!winner || bidData.bid > winner.bid) {
      winner = bidData;
    }
  }
  if (!winner) {
    return true;
  }
  // Make all the network requests in parallel.
  await Promise.all(
    (function* () {
      for (const trustedBiddingSignalsUrl of trustedBiddingSignalsUrls) {
        yield fetchAndValidateTrustedSignals(
          trustedBiddingSignalsUrl,
          `hostname=${encodeURIComponent(hostname)}`
        );
      }
      if (trustedScoringSignalsUrl !== undefined) {
        yield fetchAndValidateTrustedSignals(
          trustedScoringSignalsUrl,
          `keys=${[...renderUrls].map(encodeURIComponent).join(",")}`
        );
      }
    })()
  );
  const token = randomToken();
  sessionStorage.setItem(token, winner.render);
  return token;
}

async function fetchScriptAndBid(
  biddingLogicUrl: string,
  group: CanonicalInterestGroup,
  extraScript: string
) {
  const fetchResult = await tryFetchJavaScript(biddingLogicUrl);
  switch (fetchResult.status) {
    case FetchStatus.OK: {
      const bidData = await runBiddingScript(
        fetchResult.value,
        group,
        extraScript
      );
      if (!bidData) {
        // Error has already been logged in the Web Worker.
        return null;
      }
      if (!group.ads.some(({ renderUrl }) => renderUrl === bidData.render)) {
        logWarning("Bid render URL", [
          bidData.render,
          "is not in interest group:",
          group,
        ]);
        return null;
      }
      // Silently discard zero, negative, infinite, and NaN bids.
      if (!(bidData.bid > 0 && bidData.bid < Infinity)) {
        return null;
      }
      return bidData;
    }
    case FetchStatus.NETWORK_ERROR:
      // Browser will have logged the error; no need to log it again.
      return null;
    case FetchStatus.VALIDATION_ERROR:
      logWarning("Cannot use bidding script from", [
        biddingLogicUrl,
        ": " + fetchResult.errorMessage,
        ...(fetchResult.errorData ?? []),
      ]);
      return null;
  }
}

async function fetchAndValidateTrustedSignals(
  baseUrl: string,
  queryString: string
) {
  let url;
  try {
    url = new URL(baseUrl);
  } catch (error: unknown) {
    /* istanbul ignore else */
    if (error instanceof TypeError) {
      logWarning("Invalid URL:", [baseUrl]);
      return;
    } else {
      throw error;
    }
  }
  if (url.search) {
    logWarning("Query string not allowed in URL:", [baseUrl]);
    return;
  }
  url.search = queryString;
  const response = await tryFetchJson(url.href);
  const basicErrorMessage = "Cannot use trusted scoring signals from";
  switch (response.status) {
    case FetchStatus.OK: {
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
    case FetchStatus.NETWORK_ERROR:
      // Browser will have logged the error; no need to log it again.
      return;
    case FetchStatus.VALIDATION_ERROR:
      logWarning(basicErrorMessage, [
        url.href,
        ": " + response.errorMessage,
        ...(response.errorData ?? []),
      ]);
      return;
  }
}

function randomToken() {
  return Array.prototype.map
    .call(crypto.getRandomValues(new Uint8Array(16)), (byte: number) =>
      byte.toString(/* radix= */ 16).padStart(2, "0")
    )
    .join("");
}
