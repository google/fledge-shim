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
 * The properties of this type aren't actually specified in the FLEDGE spec at
 * present; they are our best guess as to how this will work, and may be
 * replaced later with a different API.
 */
export interface AuctionAd {
  /**
   * The URL where the actual creative is hosted. This will be used as the `src`
   * of an iframe that will appear on the page if this ad wins.
   */
  renderUrl: string;
  /** Additional metadata about this ad that can be read by the auction. */
  metadata: {
    /**
     * The amount that the buyer is willing to pay in order to have this ad
     * selected. The ad with the highest price is selected; in case of a tie, an
     * ad with the highest price is selected arbitrarily (based on IndexedDB
     * implementation details).
     *
     * This is used by our temporary hardcoded auction logic and will not exist
     * in browser-native implementations of FLEDGE (in which auction logic, and
     * the structure and semantics of ad metadata, will be user-defined).
     *
     * The precise meaning of this value (what currency it's in, CPM vs. CPC,
     * etc.) is a matter of convention among buyers and sellers. The current
     * implementation requires the entire ecosystem to adopt a uniform
     * convention, which is impractical, but future implementations will allow
     * sellers to choose which buyers to transact with, which will allow them to
     * deal only with buyers with whom they've made out-of-band agreements that
     * specify the meaning.
     */
    price: number;
  };
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
   * An HTTPS URL with no query string. If provided, a request to this URL is
   * made at auction time. The response is expected to be a JSON object.
   *
   * @see https://github.com/WICG/turtledove/blob/main/FLEDGE.md#31-fetching-real-time-data-from-a-trusted-server
   */
  trustedScoringSignalsUrl?: string;
}
