/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Serialization and deserialization functions for the messaging
 * protocol that's used to communicate between the library and the frame after
 * the initial handshake. For simple data types, type guards are used instead.
 */

import { AuctionAdConfig, InterestGroup } from "../public_api";
import { isArray } from "./guards";

/**
 * Wire-format type of the message sent from the library to the frame whenever
 * an API call is made to the library. This type is a discriminated union so
 * that the frame can first check which API was called, then validate the inputs
 * for that API.
 */
export type FledgeRequest =
  | { kind: RequestKind.JOIN_AD_INTEREST_GROUP; group: InterestGroup }
  | { kind: RequestKind.LEAVE_AD_INTEREST_GROUP; group: InterestGroup }
  | { kind: RequestKind.RUN_AD_AUCTION; config: AuctionAdConfig };

/**
 * Discriminator for the above discriminated union. Each value corresponds to
 * a different exposed API.
 */
export enum RequestKind {
  JOIN_AD_INTEREST_GROUP,
  LEAVE_AD_INTEREST_GROUP,
  RUN_AD_AUCTION,
}

/**
 * Deserializes from postMessage wire format and returns the request it
 * represents, or null if the input does not represent a valid request.
 */
export function requestFromMessageData(
  messageData: unknown
): FledgeRequest | null {
  if (!isArray(messageData)) {
    return null;
  }
  const [kind] = messageData;
  switch (kind) {
    case RequestKind.JOIN_AD_INTEREST_GROUP: {
      if (messageData.length !== 3) {
        return null;
      }
      const [, name, adsMessageData] = messageData;
      if (typeof name !== "string") {
        return null;
      }
      let ads;
      if (isArray(adsMessageData)) {
        ads = [];
        for (const adMessageData of adsMessageData) {
          if (!(isArray(adMessageData) && adMessageData.length === 2)) {
            return null;
          }
          const [renderingUrl, price] = adMessageData;
          if (
            !(typeof renderingUrl === "string" && typeof price === "number")
          ) {
            return null;
          }
          ads.push({ renderingUrl, metadata: { price } });
        }
      } else if (adsMessageData !== undefined) {
        return null;
      }
      return { kind, group: { name, ads } };
    }
    case RequestKind.LEAVE_AD_INTEREST_GROUP: {
      if (messageData.length !== 2) {
        return null;
      }
      const [, name] = messageData;
      if (typeof name !== "string") {
        return null;
      }
      return { kind, group: { name } };
    }
    case RequestKind.RUN_AD_AUCTION: {
      if (messageData.length !== 2) {
        return null;
      }
      const [, trustedScoringSignalsUrl] = messageData;
      if (
        !(
          trustedScoringSignalsUrl === undefined ||
          typeof trustedScoringSignalsUrl === "string"
        )
      ) {
        return null;
      }
      return { kind, config: { trustedScoringSignalsUrl } };
    }
    default:
      return null;
  }
}

/** Serializes a request to postMessage wire format. */
export function messageDataFromRequest(request: FledgeRequest): unknown {
  switch (request.kind) {
    case RequestKind.JOIN_AD_INTEREST_GROUP: {
      const {
        kind,
        group: { name, ads },
      } = request;
      return [
        kind,
        name,
        ads?.map(({ renderingUrl, metadata: { price } }) => [
          renderingUrl,
          price,
        ]),
      ];
    }
    case RequestKind.LEAVE_AD_INTEREST_GROUP:
      return [request.kind, request.group.name];
    case RequestKind.RUN_AD_AUCTION:
      return [request.kind, request.config.trustedScoringSignalsUrl];
  }
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
