/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview CRUD operations on our data model for persistent storage in
 * IndexedDB, with runtime type checking.
 */

import { AuctionAd } from "../lib/shared/api_types";

/**
 * Analogous to `InterestGroup` from `../lib/shared/api_types`, but all fields
 * are required. This represents an interest group as it is stored and used
 * internally.
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
   * The amount that the buyer is willing to pay in order to have this ad
   * selected. The highest bid is selected; in case of a tie, one of the highest
   * bids is selected based on database order.
   *
   * Browser-native implementations of FLEDGE will instead pass each bid to be
   * evaluated by a decision script.
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
