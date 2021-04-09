/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/** @fileoverview TODO */

import { isArray } from "./types";

/** TODO */
export type FledgeRequest =
  | [RequestTag.JOIN_AD_INTEREST_GROUP, JoinAdInterestGroupRequest]
  | [RequestTag.LEAVE_AD_INTEREST_GROUP, LeaveAdInterestGroupRequest]
  | [RequestTag.RUN_AD_AUCTION, RunAdAuctionRequest];

/** TODO */
export enum RequestTag {
  JOIN_AD_INTEREST_GROUP,
  LEAVE_AD_INTEREST_GROUP,
  RUN_AD_AUCTION,
}

/** TODO */
export type JoinAdInterestGroupRequest = [
  name: string,
  ads: Array<[renderingUrl: string, cpmInUsd: number]>
];

/** TODO */
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

/** TODO */
export type LeaveAdInterestGroupRequest = string;

/** TODO */
export function isLeaveAdInterestGroupRequest(
  message: unknown
): message is LeaveAdInterestGroupRequest {
  return typeof message === "string";
}

/** TODO */
export type RunAdAuctionRequest = null;

/** TODO */
export function isRunAdAuctionRequest(
  message: unknown
): message is RunAdAuctionRequest {
  return message === null;
}

/** TODO */
// Responses don't use a raw string because those represent errors, so wrap in a
// 1-tuple.
export type RunAdAuctionResponse = [token: string | null];

/** TODO */
export function isRunAdAuctionResponse(
  message: unknown
): message is RunAdAuctionResponse {
  if (!isArray(message) || message.length !== 1) {
    return false;
  }
  const [token] = message;
  return typeof token === "string" || token === null;
}
