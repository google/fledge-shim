/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/** @fileoverview Utilities for making HTTP requests to the network. */

import { assertInstance } from "../lib/shared/types";

/**
 * The kinds of things that can happen as a result of trying to fetch JSON over
 * HTTP.
 */
export enum FetchJsonStatus {
  /**
   * JSON was successfully fetched and parsed. Note that this can happen even if
   * the response has a 4xx or 5xx status code; status codes are ignored.
   */
  OK,
  /**
   * No response was received from the HTTP request. This could be due to a
   * network problem (no connectivity, domain doesn't exist, etc.) or the
   * browser not allowing the script to see the response for security reasons
   * (e.g., CORS problem).
   */
  NETWORK_ERROR,
  /**
   * An HTTP response was received but its body wasn't syntactically valid JSON.
   */
  JSON_PARSE_ERROR,
}

/** The result of trying to fetch JSON over HTTP. */
export type FetchJsonResult =
  | {
      status: FetchJsonStatus.OK;
      /** The value parsed from the JSON response. */
      value: unknown;
    }
  | { status: FetchJsonStatus.NETWORK_ERROR }
  | {
      status: FetchJsonStatus.JSON_PARSE_ERROR;
      /**
       * The JSON parse error message, which may contain information about,
       * e.g., where the illegal character occurred.
       */
      errorMessage: string;
    };

/**
 * Makes an HTTP request to a URL that's supposed to serve a JSON response body,
 * and returns the parsed response.
 */
export async function tryFetchJson(url: string): Promise<FetchJsonResult> {
  let response;
  try {
    response = await fetch(url);
  } catch {
    return { status: FetchJsonStatus.NETWORK_ERROR };
  }
  let value: unknown;
  try {
    value = await response.json();
  } catch (error: unknown) {
    assertInstance(error, SyntaxError);
    return {
      status: FetchJsonStatus.JSON_PARSE_ERROR,
      errorMessage: error.message,
    };
  }
  return { status: FetchJsonStatus.OK, value };
}
