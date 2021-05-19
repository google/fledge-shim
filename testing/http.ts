/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Utility functions used only in test code, that facilitate
 * hermetic testing of HTTP requests.
 *
 * Any request to a `.test` domain will be intercepted by a service worker. This
 * code installs the service worker and manages its lifecycle, and allows test
 * code to control responses to such requests. By default, an empty response is
 * used.
 *
 * We use a service worker instead of simply monkeypatching `fetch` because
 * end-to-end tests of the library require intercepting requests made from
 * within the frame, and test code for those tests doesn't run within the frame,
 * so there's no opportunity to monkeypatch. We don't simulate everything
 * perfectly (e.g., CORS), but the basics of HTTP requests and responses are
 * covered.
 */

import "jasmine";
import { awaitMessageToPort } from "../lib/shared/messaging";
import { assert, isArray, nonNullish } from "../lib/shared/types";

/**
 * The parts of an HTTP fetch request that this library simulates. This is
 * passed to callers in the `FakeServerHandler` callback type, so for caller
 * convenience, callers can assume they're all there and can mutate them.
 */
export interface FakeRequest {
  /** Full absolute URL. */
  url: URL;
  /** GET, POST, etc. */
  method: string;
  /**
   * Request headers, including ones that are provided by the browser like
   * User-Agent, but excluding ones that the browser doesn't expose to
   * JavaScript code like Cookie. Names are always lowercase. Duplicate headers
   * aren't supported.
   */
  headers: { [name: string]: string };
  /**
   * Request body in binary format, after being read in its entirety.
   * Incremental streaming of the body isn't supported.
   */
  body: Uint8Array;
  /**
   * Whether credential headers (e.g., Cookie) would have been included in this
   * request. (They're never included in the headers property, because the
   * browser doesn't expose them to JavaScript.) Note that the default fetch
   * behavior makes this false, because the fake server only intercepts requests
   * to .test domains, which are assumed to be cross-origin.
   */
  hasCredentials: boolean;
}

/**
 * The parts of an HTTP fetch response that this library simulates. This is
 * passed from callers in the `FakeServerHandler` callback type, so for caller
 * convenience, callers can omit ones that aren't needed and can assume that
 * they won't be needed.
 */
export interface FakeResponse {
  /** Numeric status code (e.g., 200, 404). */
  readonly status?: number;
  /** Status message (e.g., OK, Not Found). */
  readonly statusText?: string;
  /**
   * Response headers, excluding ones that the browser doesn't expose to
   * JavaScript code like Set-Cookie. Names will be lowercased by the browser
   * before being returned from fetch. A Content-Type header may be added by
   * the browser if one isn't provided here, but only if there is a response
   * body at all. Duplicate headers aren't supported.
   */
  readonly headers?: { readonly [name: string]: string };
  /** Response body. Streaming isn't supported. */
  readonly body?: string | Readonly<BufferSource>;
}

/** A callback that consumes an HTTP request and returns a response. */
export type FakeServerHandler = (request: FakeRequest) => Promise<FakeResponse>;

let registration: ServiceWorkerRegistration;
let port: MessagePort;
let currentHandler: FakeServerHandler;

/**
 * For the remainder of the current test spec, whenever an HTTP request is made
 * to a `.test` URL, call the given handler function passing that URL, and use
 * its return value as the response body, instead of the default empty string.
 * If this has already been called earlier in the same spec, the previous
 * handler is overwritten.
 *
 * Don't call this if an HTTP request has been sent but its response hasn't been
 * awaited; race conditions are likely to occur in that case.
 */
export function setFakeServerHandler(handler: FakeServerHandler): void {
  currentHandler = handler;
}

function resetHandler() {
  setFakeServerHandler(() => Promise.resolve({}));
}
resetHandler();
afterEach(resetHandler);

beforeAll(async () => {
  const controllerChangePromise = new Promise((resolve) => {
    navigator.serviceWorker.addEventListener("controllerchange", resolve, {
      once: true,
    });
  });
  registration = await navigator.serviceWorker.register("/fake_server.js");
  await controllerChangePromise;
  const channel = new MessageChannel();
  port = channel.port1;
  const readyMessagePromise = awaitMessageToPort(port);
  nonNullish(navigator.serviceWorker.controller).postMessage(null, [
    channel.port2,
  ]);
  await readyMessagePromise;
  port.onmessage = async ({ data, ports }: MessageEvent<unknown>) => {
    assert(isArray(data) && data.length === 5);
    const [url, method, requestHeaders, requestBody, hasCredentials] = data;
    assert(
      typeof url === "string" &&
        typeof method === "string" &&
        Array.isArray(requestHeaders) &&
        requestHeaders.every((header): header is [
          name: string,
          value: string
        ] => {
          if (!isArray(header) || header.length !== 2) {
            return false;
          }
          const [name, value] = header;
          return typeof name === "string" && typeof value === "string";
        }) &&
        requestBody instanceof ArrayBuffer &&
        typeof hasCredentials === "boolean"
    );
    const {
      status,
      statusText,
      headers: responseHeaders,
      body: responseBody,
    } = await currentHandler({
      url: new URL(url),
      method,
      headers: Object.fromEntries(requestHeaders),
      body: new Uint8Array(requestBody),
      hasCredentials,
    });
    ports[0].postMessage([status, statusText, responseHeaders, responseBody]);
  };
});

afterAll(() => {
  port.postMessage(null);
  port.close();
  return registration.unregister();
});