/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/** @fileoverview TODO */

import * as uuid from "uuid";
import {
  RequestTag,
  isJoinAdInterestGroupRequest,
  isLeaveAdInterestGroupRequest,
  isRunAdAuctionRequest,
  RunAdAuctionResponse,
} from "../lib/shared/protocol";
import { isArray } from "../lib/shared/types";
import { errorMessage } from "./error";
import { setInterestGroupAds, deleteInterestGroup, getAllAds } from "./storage";

/**
 * TODO
 *
 * @param callbackForTesting TODO
 */
export async function handleRequest(
  { data, ports }: MessageEvent<unknown>,
  callbackForTesting: () => void = () => {
    // Do nothing
  }
): Promise<void> {
  try {
    callbackForTesting();
    function checkData(condition: boolean): asserts condition {
      if (!condition) {
        throw new Error(`Malformed request: ${JSON.stringify(data)}`);
      }
    }
    checkData(isArray(data));
    switch (data[0]) {
      case RequestTag.JOIN_AD_INTEREST_GROUP: {
        const [, request] = data;
        checkData(isJoinAdInterestGroupRequest(request));
        const [name, ads] = request;
        await setInterestGroupAds(name, ads);
        return;
      }
      case RequestTag.LEAVE_AD_INTEREST_GROUP: {
        const [, request] = data;
        checkData(isLeaveAdInterestGroupRequest(request));
        await deleteInterestGroup(request);
        return;
      }
      case RequestTag.RUN_AD_AUCTION: {
        const [, request] = data;
        checkData(isRunAdAuctionRequest(request));
        if (ports.length !== 1) {
          throw new Error(
            `Port transfer mismatch during handshake: expected 1 port, but received ${ports.length}`
          );
        }
        const [port] = ports;
        const token = await runAdAuction();
        const response: RunAdAuctionResponse = [token];
        port.postMessage(response);
        return;
      }
      default:
        checkData(false);
    }
  } catch (error: unknown) {
    const message = errorMessage(error);
    for (const port of ports) {
      port.postMessage(message);
    }
  }
}

async function runAdAuction() {
  const ads = await getAllAds();
  const firstAdResult = ads.next();
  if (firstAdResult.done) {
    return null;
  }
  let [winningRenderingUrl, winningCpmInUsd] = firstAdResult.value;
  for (const [renderingUrl, cpmInUsd] of ads) {
    if (cpmInUsd > winningCpmInUsd) {
      winningRenderingUrl = renderingUrl;
      winningCpmInUsd = cpmInUsd;
    }
  }
  const token = uuid.v4();
  sessionStorage.setItem(token, winningRenderingUrl);
  return token;
}
