/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Utilities for running code in a worklet-like environment.
 * (Browser-native implementations of FLEDGE will use real worklets, but
 * JavaScript code can't create custom worklets, so we use Web Workers instead.)
 */

import { isArray } from "../lib/shared/guards";
import { awaitMessageToWorker } from "../lib/shared/messaging";
import { BidData, CanonicalInterestGroup } from "./types";

/**
 * Interprets `biddingScript` as JavaScript code and runs it in a worklet-like
 * Web Worker environment, then calls its `generateBid` function and returns the
 * result, or null if any exceptions or validation errors occur. (Such errors
 * are logged, either inside or outside the Web Worker.)
 *
 * We take defensive measures to prevent misbehaving scripts from corrupting the
 * frame's own state, but we do *not* defend against exfiltration. If an
 * untrusted domain or path is included in `ALLOWED_LOGIC_URL_PREFIXES`, then
 * scripts served from that domain or path can be passed here and can see and
 * exfiltrate interest groups and associated data.
 *
 * @param group The originating interest group, passed through to generateBid.
 * @param extraScript Additional JavaScript code to run in the Web Worker before
 * anything else. In production, this is always empty; in tests, it's used to
 * stub out `console.warn`.
 */
export async function runBiddingScript(
  biddingScript: string,
  group: CanonicalInterestGroup,
  extraScript: string
): Promise<BidData | null> {
  const worker = new Worker(
    "data:application/javascript," +
      encodeURIComponent(
        [
          extraScript,
          // Comments are inside the quotes to avoid awkward indentation.
          "((biddingScript, group) => {",
          "  // Get local bindings to globals that we might use after",
          "  // biddingScript runs, so that it can't overwrite them.",
          "  const global = self;",
          "  const postMsg = postMessage;",
          "  // If warnings need to be logged, we do so from inside the worker",
          "  // in order to avoid losing context in transit with postMessage.",
          "  const { warn } = console;",
          "  function handleError(message, data) {",
          "    warn('[FLEDGE Shim] ' + message, data);",
          "    postMsg([]);",
          "  }",
          "  // Don't let biddingScript send messages to the window; only",
          "  // our code should do that.",
          "  delete postMessage;",
          "  const biddingScriptErrorMessage = 'Error in bidding script:'",
          "  let generateBid;",
          "  try {",
          "    // Run biddingScript in its own scope without access to",
          "    // this code's locals.",
          "    importScripts(",
          "      'data:application/javascript,' +",
          "        encodeURIComponent(biddingScript)",
          "    );",
          "    // After the script runs, any property might have been",
          "    // monkeypatched with an ill-behaved getter, so all further",
          "    // property accesses are in try blocks.",
          "    generateBid = global['generateBid'];",
          "  } catch (error) {",
          "    handleError(biddingScriptErrorMessage, error);",
          "    return;",
          "  }",
          "  if (typeof generateBid !== 'function') {",
          "    handleError('generateBid is not a function:', generateBid);",
          "    return;",
          "  }",
          "  let bidData;",
          "  let bid;",
          "  let render;",
          "  try {",
          "    bidData = generateBid(group);",
          "    bid = bidData?.['bid'];",
          "    render = bidData?.['render'];",
          "  } catch (error) {",
          "    handleError(biddingScriptErrorMessage, error);",
          "    return;",
          "  }",
          "  if (",
          "    !(typeof bid === 'number' && typeof render === 'string')",
          "  ) {",
          "    handleError(",
          "      'generateBid did not return valid bid data:',",
          "      bidData",
          "    );",
          "    return;",
          "  }",
          "  postMsg([bid, render]);",
          `})(${JSON.stringify(biddingScript)}, ${JSON.stringify(group)});`,
        ].join("\n")
      )
  );
  let message;
  try {
    message = await awaitMessageToWorker(worker);
  } finally {
    worker.terminate();
  }
  // It shouldn't be possible for a messageerror to occur or for message data
  // to be of the wrong type; biddingScript has no access to postMessage, and
  // the outer script type-checks values before sending them.
  /* istanbul ignore if */
  if (!message) {
    throw new Error();
  }
  const { data } = message;
  /* istanbul ignore if */
  if (!isArray(data)) {
    throw new Error(String(data));
  }
  switch (data.length) {
    case 0:
      return null;
    case 2: {
      const [bid, render] = data;
      /* istanbul ignore if */
      if (!(typeof bid === "number" && typeof render === "string")) {
        throw new Error(String(data));
      }
      return { bid, render };
    }
    /* istanbul ignore next */
    default:
      throw new Error(String(data));
  }
}
