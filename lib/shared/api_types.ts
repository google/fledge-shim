/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Type definitions used both in the public API and internally in
 * implementation code.
 */

/**
 * An ad creative that can participate in an auction and later be rendered onto
 * the page if it wins.
 *
 * The properties of this type aren't actually specified in the FLEDGE explainer
 * at present; they are our best guess as to how this will work, and may be
 * replaced later with a different API.
 */
export interface AuctionAd {
  /**
   * The URL where the actual creative is hosted. This will be used as the `src`
   * of an iframe that will appear on the page if this ad wins.
   */
  renderUrl: string;
  /** Additional metadata about this ad that can be read by the auction. */
  // eslint-disable-next-line @typescript-eslint/ban-types
  metadata?: object;
}

/**
 * A collection of ad creatives, with associated metadata.
 *
 * @see https://github.com/WICG/turtledove/blob/main/FLEDGE.md#1-browsers-record-interest-groups
 */
export interface AuctionAdInterestGroup {
  /**
   * A name that uniquely identifies this interest group within the browser,
   * that can be used to refer to it in order to update or delete it later.
   */
  name: string;
  /**
   * An HTTPS URL. At auction time, the bidding script is fetched from here and
   * its `generateBid` function is called in an isolated worklet-like
   * environment. The script must be served with a JavaScript MIME type and with
   * the header `X-FLEDGE-Shim: true`, and its URL must begin with one of the
   * prefixes specified when building the frame. If undefined, this interest
   * group is silently skipped.
   */
  biddingLogicUrl?: string;
  /**
   * An HTTPS URL with no query string. If provided, a request to this URL is
   * made at auction time. The response is expected to be a JSON object.
   */
  trustedBiddingSignalsUrl?: string;
  /**
   * Ads to be entered into the auction for impressions that this interest group
   * is permitted to bid on.
   */
  ads?: AuctionAd[];
}

/**
 * Parameters for running an auction, specified by the seller.
 *
 * @see https://github.com/WICG/turtledove/blob/main/FLEDGE.md#2-sellers-run-on-device-auctions
 */
export interface AuctionAdConfig {
  /**
   * An HTTPS URL. At auction time, the auction script is fetched from here and
   * its `scoreAd` function is called in an isolated worklet-like environment.
   * The script must be served with a JavaScript MIME type and with the header
   * `X-FLEDGE-Shim: true`, and its URL must begin with one of the prefixes
   * specified when building the frame. If undefined, the entire auction is
   * silently skipped.
   */
  decisionLogicUrl: string;
  /**
   * An HTTPS URL with no query string. If provided, a request to this URL is
   * made at auction time. The response is expected to be a JSON object.
   *
   * @see https://github.com/WICG/turtledove/blob/main/FLEDGE.md#31-fetching-real-time-data-from-a-trusted-server
   */
  trustedScoringSignalsUrl?: string;
}
