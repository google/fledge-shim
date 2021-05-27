/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Dispatcher that does basic validation on requests and then
 * forwards them to the appropriate function.
 */

import { isArray } from "../lib/shared/guards";
import {
  RequestTag,
  isJoinAdInterestGroupRequest,
  isLeaveAdInterestGroupRequest,
  isRunAdAuctionRequest,
  RunAdAuctionResponse,
} from "../lib/shared/protocol";
import { runAdAuction } from "./auction";
import { setInterestGroupAds, deleteInterestGroup } from "./db_schema";

/**
 * Handles a `MessageEvent` representing a request to the FLEDGE API, and sends
 * a response via the provided ports if needed.
 *
 * If an error occurs, a message is sent to each provided port so that the
 * caller doesn't hang.
 *
 * @param hostname The hostname of the page where the FLEDGE Shim API is
 * running.
 */
export async function handleRequest(
  { data, ports }: MessageEvent<unknown>,
  hostname: string
): Promise<void> {
  try {
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
            `Port transfer mismatch during request: expected 1 port, but received ${ports.length}`
          );
        }
        const [port] = ports;
        const token = await runAdAuction(request, hostname);
        const response: RunAdAuctionResponse = [true, token];
        port.postMessage(response);
        port.close();
        return;
      }
      default:
        checkData(false);
    }
  } catch (error: unknown) {
    const response: RunAdAuctionResponse = [false];
    for (const port of ports) {
      port.postMessage(response);
    }
    throw error;
  }
}
