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

/**
 * The kinds of things that can happen as a result of trying to fetch JSON or
 * JavaScript over HTTP.
 */
export enum FetchStatus {
  /**
   * JSON or JavaScript was successfully fetched and parsed. Note that this can
   * happen even if the response has a 4xx or 5xx status code; status codes are
   * ignored.
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
   * to all the preconditions (some of which aren't currently in the explainer
   * but are enforced by Chrome's implementation).
   */
  VALIDATION_ERROR,
}

/** The result of trying to fetch JSON or JavaScript over HTTP. */
export type FetchResult<T> =
  | {
      status: FetchStatus.OK;
      /** The response, after any applicable postprocessing. */
      value: T;
    }
  | { status: FetchStatus.NETWORK_ERROR }
  | {
      status: FetchStatus.VALIDATION_ERROR;
      /** A human-readable explanation of which precondition wasn't met. */
      errorMessage: string;
      /** Data to be logged alongside the error message. */
      errorData?: readonly unknown[];
    };

async function tryFetch(
  url: string,
  mimeType: string,
  mimeTypeRegExp: RegExp,
  mimeTypeDescription: string
): Promise<FetchResult<Response>> {
  const requestInit: RequestInit = {
    headers: new Headers({ "Accept": mimeType }),
    credentials: "omit",
    redirect: "error",
  };
  let response;
  try {
    response = await fetch(url, requestInit);
  } catch (error: unknown) {
    /* istanbul ignore else */
    if (error instanceof TypeError) {
      return { status: FetchStatus.NETWORK_ERROR };
    } else {
      throw error;
    }
  }
  const contentType = response.headers.get("Content-Type");
  if (contentType === null) {
    return {
      status: FetchStatus.VALIDATION_ERROR,
      errorMessage: `Expected ${mimeTypeDescription} MIME type but received none`,
    };
  }
  if (!mimeTypeRegExp.test(contentType)) {
    return {
      status: FetchStatus.VALIDATION_ERROR,
      errorMessage: `Expected ${mimeTypeDescription} MIME type but received:`,
      errorData: [contentType],
    };
  }
  const xAllowFledge = response.headers.get("X-Allow-FLEDGE");
  if (xAllowFledge === null) {
    return {
      status: FetchStatus.VALIDATION_ERROR,
      errorMessage: "Expected header X-Allow-FLEDGE: true but received none",
    };
  }
  if (!/^true$/i.test(xAllowFledge)) {
    return {
      status: FetchStatus.VALIDATION_ERROR,
      errorMessage: "Expected header X-Allow-FLEDGE: true but received:",
      errorData: [xAllowFledge],
    };
  }
  return { status: FetchStatus.OK, value: response };
}

/**
 * Makes an HTTP request to a URL that's supposed to serve a JSON response body,
 * and returns the parsed response.
 */
export async function tryFetchJson(url: string): Promise<FetchResult<unknown>> {
  const result = await tryFetch(
    url,
    "application/json",
    // https://mimesniff.spec.whatwg.org/#json-mime-type
    // Chrome's behavior deviates from the spec here; it only allows +json if
    // the top-level type is application.
    /^\s*(application\/([^;]*\+)?|text\/)json\s*(;.*)?$/i,
    "JSON"
  );
  if (result.status !== FetchStatus.OK) {
    return result;
  }
  const response = result.value;
  let value: unknown;
  try {
    value = await response.json();
  } catch (error: unknown) {
    if (error instanceof TypeError) {
      return { status: FetchStatus.NETWORK_ERROR };
    } /* istanbul ignore else */ else if (error instanceof SyntaxError) {
      return {
        status: FetchStatus.VALIDATION_ERROR,
        errorMessage: error.message,
      };
    } else {
      throw error;
    }
  }
  return { status: FetchStatus.OK, value };
}

/**
 * Makes an HTTP request to a URL that's supposed to serve a JavaScript response
 * body, and returns the script as a string.
 */
export async function tryFetchJavaScript(
  url: string
): Promise<FetchResult<string>> {
  const result = await tryFetch(
    url,
    "application/javascript",
    // https://mimesniff.spec.whatwg.org/#javascript-mime-type
    /^\s*((application|text)\/(x-)?(jav|ecm)ascript|text\/(javascript1\.[0-5]|(j|live)script))\s*(;.*)?$/i,
    "JavaScript"
  );
  if (result.status !== FetchStatus.OK) {
    return result;
  }
  const response = result.value;
  let value: string;
  try {
    value = await response.text();
  } catch (error: unknown) {
    /* istanbul ignore else */
    if (error instanceof TypeError) {
      return { status: FetchStatus.NETWORK_ERROR };
    } else {
      throw error;
    }
  }
  return { status: FetchStatus.OK, value };
}
