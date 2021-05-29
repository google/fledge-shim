/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Dispatcher that does basic validation on requests and then
 * forwards them to the appropriate function.
 */

import {
  requestFromMessageData,
  RequestKind,
  RunAdAuctionResponse,
} from "../lib/shared/protocol";
import { runAdAuction } from "./auction";
import { deleteInterestGroup, storeInterestGroup } from "./db_schema";

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
    const request = requestFromMessageData(data);
    if (!request) {
      throw new Error(`Malformed request: ${JSON.stringify(data)}`);
    }
    switch (request.kind) {
      case RequestKind.JOIN_AD_INTEREST_GROUP:
        // Ignore return value; any errors will have already been logged and
        // there's nothing more to be done about them.
        await storeInterestGroup(request.group);
        return;
      case RequestKind.LEAVE_AD_INTEREST_GROUP:
        // Ignore return value; any errors will have already been logged and
        // there's nothing more to be done about them.
        await deleteInterestGroup(request.group.name);
        return;
      case RequestKind.RUN_AD_AUCTION: {
        if (ports.length !== 1) {
          throw new Error(
            `Port transfer mismatch during request: expected 1 port, but received ${ports.length}`
          );
        }
        const [port] = ports;
        const response: RunAdAuctionResponse = await runAdAuction(
          request.config,
          hostname
        );
        if (response === false) {
          throw new Error("IndexedDB error");
        }
        port.postMessage(response);
        return;
      }
    }
  } finally {
    for (const port of ports) {
      port.close();
    }
  }
}
