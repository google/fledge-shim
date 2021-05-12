/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Types and type guards for the messaging protocol that's used to
 * communicate between the library and the frame after the initial handshake. In
 * general, messages sent over `MessageChannel`s are instances of one of thes
 * types. The type guards facilitate validation at each end.
 */

import { isArray } from "./types";

/**
 * Wire-format type of the message sent from the library to the frame whenever
 * an API call is made to the library. This type is a discriminated union so
 * that the frame can first check which API was called, then validate the inputs
 * for that API.
 */
export type FledgeRequest =
  | [RequestTag.JOIN_AD_INTEREST_GROUP, JoinAdInterestGroupRequest]
  | [RequestTag.LEAVE_AD_INTEREST_GROUP, LeaveAdInterestGroupRequest]
  | [RequestTag.RUN_AD_AUCTION, RunAdAuctionRequest];

/**
 * Discriminator for the above discriminated union. Each value corresponds to
 * a different exposed API.
 */
export enum RequestTag {
  JOIN_AD_INTEREST_GROUP,
  LEAVE_AD_INTEREST_GROUP,
  RUN_AD_AUCTION,
}

/** Inputs for `joinAdInterestGroup` serialized into wire format. */
export type JoinAdInterestGroupRequest = [
  name: string,
  ads: Array<[renderingUrl: string, cpmInUsd: number]>
];

/** Type guard for {@link JoinAdInterestGroupRequest}. */
export function isJoinAdInterestGroupRequest(
  message: unknown
): message is JoinAdInterestGroupRequest {
  if (!isArray(message) || message.length !== 2) {
    return false;
  }
  const [name, ads] = message;
  return (
    typeof name === "string" &&
    isArray(ads) &&
    ads.every((ad: unknown) => {
      if (!isArray(ad) || ad.length !== 2) {
        return false;
      }
      const [renderingUrl, cpmInUsd] = ad;
      return typeof renderingUrl === "string" && typeof cpmInUsd === "number";
    })
  );
}

/**
 * Inputs for `leaveAdInterestGroup` serialized into wire format. Currently
 * just a type alias for string because this API doesn't take any inputs with
 * more complicated structure.
 */
export type LeaveAdInterestGroupRequest = string;

/** Type guard for {@link LeaveAdInterestGroupRequest}. */
export function isLeaveAdInterestGroupRequest(
  message: unknown
): message is LeaveAdInterestGroupRequest {
  return typeof message === "string";
}

/**
 * Inputs for `runAdAuction` serialized into wire format. Currently just a type
 * alias for string or `null` because this API doesn't take any inputs with more
 * complicated structure.
 */
export type RunAdAuctionRequest = string | null;

/** Type guard for {@link RunAdAuctionRequest}. */
export function isRunAdAuctionRequest(
  message: unknown
): message is RunAdAuctionRequest {
  return typeof message === "string" || message === null;
}

/**
 * Wire-format type of the message sent from the frame to the library in
 * response to a `runAdAuction` call, over the one-off `MessageChannel`
 * established by the library during that call.
 */
export type RunAdAuctionResponse =
  | [success: false]
  | [success: true, token: string | null];

/** Type guard for {@link RunAdAuctionResponse}. */
export function isRunAdAuctionResponse(
  message: unknown
): message is RunAdAuctionResponse {
  if (!isArray(message)) {
    return false;
  }
  switch (message[0]) {
    case true: {
      if (message.length !== 2) {
        return false;
      }
      const [, token] = message;
      return typeof token === "string" || token === null;
    }
    case false:
      return message.length === 1;
    default:
      return false;
  }
}
