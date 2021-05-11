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
 * code to control responses to such requests. Such responses always have status
 * 200 and no additional headers. By default, they have an empty body.
 *
 * We use a service worker instead of simply monkeypatching `fetch` because
 * end-to-end tests of the library require intercepting requests made from
 * within the frame, and test code for those tests doesn't run within the frame,
 * so there's no opportunity to monkeypatch.
 */

import "jasmine";
import { awaitMessageToPort } from "../messaging";
import { assert, nonNullish } from "../types";

/** A callback that consumes an HTTP request and returns a response. */
export type FakeServerHandler = (requestUrl: URL) => Promise<string>;

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
  setFakeServerHandler(() => Promise.resolve(""));
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
    assert(typeof data === "string");
    ports[0].postMessage(await currentHandler(new URL(data)));
  };
});

afterAll(() => {
  port.postMessage(null);
  port.close();
  return registration.unregister();
});
