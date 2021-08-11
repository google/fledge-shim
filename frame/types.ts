/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Type definitions that span multiple concerns within the frame.
 */

import { AuctionAd } from "../lib/shared/api_types";

/**
 * Analogous to `InterestGroup` from `../lib/shared/api_types`, but all fields
 * are required and metadata is represented as serialized JSON. This represents
 * an interest group as it is stored and used internally.
 */
export interface CanonicalInterestGroup {
  name: string;
  biddingLogicUrl: string | undefined;
  trustedBiddingSignalsUrl: string | undefined;
  ads: AuctionAd[];
}

/**
 * A bid returned by `generateBid` in a bidding script.
 *
 * @see https://github.com/WICG/turtledove/blob/main/FLEDGE.md#32-on-device-bidding
 */
export interface BidData {
  /**
   * The JSON serialization of an arbitrary metadata value provided by the
   * bidding script in association with its bid. This is passed to the scoring
   * script.
   */
  adJson: string;
  /**
   * The amount that the buyer is willing to pay in order to have this ad
   * selected. This is passed to the scoring script.
   *
   * The precise meaning of this value (what currency it's in, CPM vs. CPC,
   * etc.) is a matter of convention among buyers and sellers. The current
   * implementation requires the entire ecosystem to adopt a uniform
   * convention, which is impractical, but future implementations will allow
   * sellers to choose which buyers to transact with, which will allow them to
   * deal only with buyers with whom they've made out-of-band agreements that
   * specify the meaning.
   */
  bid: number;
  /**
   * The URL where the actual creative is hosted. This will be used as the `src`
   * of an iframe that will appear on the page if this ad wins.
   */
  render: string;
}
