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

import {
  AuctionAd,
  AuctionAdConfig,
  AuctionAdInterestGroup,
} from "../public_api";
import { isArray } from "./guards";

/**
 * A message sent from the library to the frame whenever an API call is made to
 * the library.
 */
export type FledgeRequest =
  | { kind: RequestKind.JOIN_AD_INTEREST_GROUP; group: AuctionAdInterestGroup }
  | { kind: RequestKind.LEAVE_AD_INTEREST_GROUP; group: AuctionAdInterestGroup }
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
      if (messageData.length !== 5) {
        return null;
      }
      const [
        ,
        name,
        biddingLogicUrl,
        trustedBiddingSignalsUrl,
        adsMessageData,
      ] = messageData;
      if (
        !(
          typeof name === "string" &&
          (biddingLogicUrl === undefined ||
            typeof biddingLogicUrl === "string") &&
          (trustedBiddingSignalsUrl === undefined ||
            typeof trustedBiddingSignalsUrl === "string")
        )
      ) {
        return null;
      }
      let ads;
      if (isArray(adsMessageData)) {
        ads = [];
        for (const adMessageData of adsMessageData) {
          if (!(isArray(adMessageData) && adMessageData.length === 2)) {
            return null;
          }
          const [renderUrl, metadataJson] = adMessageData;
          if (typeof renderUrl !== "string") {
            return null;
          }
          const ad: AuctionAd = { renderUrl };
          if (typeof metadataJson === "string") {
            let metadata: unknown;
            try {
              metadata = JSON.parse(metadataJson);
            } catch {
              return null;
            }
            if (typeof metadata !== "object" || metadata === null) {
              return null;
            }
            ad.metadata = metadata;
          } else if (metadataJson !== undefined) {
            return null;
          }
          ads.push(ad);
        }
      } else if (adsMessageData !== undefined) {
        return null;
      }
      return {
        kind,
        group: { name, biddingLogicUrl, trustedBiddingSignalsUrl, ads },
      };
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
      if (messageData.length !== 3) {
        return null;
      }
      const [, decisionLogicUrl, trustedScoringSignalsUrl] = messageData;
      if (
        !(
          typeof decisionLogicUrl === "string" &&
          (trustedScoringSignalsUrl === undefined ||
            typeof trustedScoringSignalsUrl === "string")
        )
      ) {
        return null;
      }
      return { kind, config: { decisionLogicUrl, trustedScoringSignalsUrl } };
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
        group: { name, biddingLogicUrl, trustedBiddingSignalsUrl, ads },
      } = request;
      return [
        kind,
        name,
        biddingLogicUrl,
        trustedBiddingSignalsUrl,
        ads?.map(({ renderUrl, metadata }) => {
          let metadataJson;
          if (metadata !== undefined) {
            metadataJson = JSON.stringify(metadata);
            if (metadataJson === undefined) {
              throw new Error("metadata is not JSON-serializable");
            }
          }
          return [renderUrl, metadataJson];
        }),
      ];
    }
    case RequestKind.LEAVE_AD_INTEREST_GROUP:
      return [request.kind, request.group.name];
    case RequestKind.RUN_AD_AUCTION:
      return [
        request.kind,
        request.config.decisionLogicUrl,
        request.config.trustedScoringSignalsUrl,
      ];
  }
}

/**
 * Wire-format type of the message sent from the frame to the library in
 * response to a `runAdAuction` call, over the one-off `MessageChannel`
 * established by the library during that call. A string is a token; true means
 * that the auction completed successfully but did not return an ad; false means
 * that an error occurred.
 */
export type RunAdAuctionResponse = string | boolean;

/** Type guard for {@link RunAdAuctionResponse}. */
export function isRunAdAuctionResponse(
  messageData: unknown
): messageData is RunAdAuctionResponse {
  return typeof messageData === "string" || typeof messageData === "boolean";
}
