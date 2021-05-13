/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Utilities for making HTTP requests to the network.
 *
 * These APIs generally aim to match the behavior of
 * https://source.chromium.org/chromium/chromium/src/+/main:content/services/auction_worklet/auction_downloader.cc
 * (the relevant part of Chrome's implementation of FLEDGE).
 */

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
   * An HTTP response was received and exposed to the script, but didn't conform
   * to all the preconditions (some of which aren't currently in the spec but
   * are enforced by Chrome's implementation).
   */
  VALIDATION_ERROR,
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
      status: FetchJsonStatus.VALIDATION_ERROR;
      /** A human-readable explanation of which precondition wasn't met. */
      errorMessage: string;
    };

/**
 * Makes an HTTP request to a URL that's supposed to serve a JSON response body,
 * and returns the parsed response.
 */
export async function tryFetchJson(url: string): Promise<FetchJsonResult> {
  const requestHeaders = new Headers({ "Accept": "application/json" });
  let response;
  try {
    response = await fetch(url, {
      headers: requestHeaders,
      credentials: "omit",
      redirect: "error",
    });
  } catch {
    return { status: FetchJsonStatus.NETWORK_ERROR };
  }
  const contentType = response.headers.get("Content-Type");
  if (contentType === null) {
    return {
      status: FetchJsonStatus.VALIDATION_ERROR,
      errorMessage: "Expected JSON MIME type but received none",
    };
  }
  if (!/^(application\/([^;]*\+)?|text\/)json(;.*)?$/i.test(contentType)) {
    return {
      status: FetchJsonStatus.VALIDATION_ERROR,
      errorMessage: `Expected JSON MIME type but received "${contentType}"`,
    };
  }
  const xAllowFledge = response.headers.get("X-Allow-FLEDGE");
  if (xAllowFledge === null) {
    return {
      status: FetchJsonStatus.VALIDATION_ERROR,
      errorMessage: "Expected header X-Allow-FLEDGE: true but received none",
    };
  }
  if (!/^true$/i.test(xAllowFledge)) {
    return {
      status: FetchJsonStatus.VALIDATION_ERROR,
      errorMessage: `Expected header X-Allow-FLEDGE: true but received "${xAllowFledge}"`,
    };
  }
  let value: unknown;
  try {
    value = await response.json();
  } catch (error: unknown) {
    assertInstance(error, SyntaxError);
    return {
      status: FetchJsonStatus.VALIDATION_ERROR,
      errorMessage: error.message,
    };
  }
  return { status: FetchJsonStatus.OK, value };
}
