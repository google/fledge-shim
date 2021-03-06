/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/** @fileoverview Service Worker installed by `./lib/shared/testing/http`. */

onactivate = (event) => {
  // The service worker is installed by the Karma test window at the beginning
  // of the tests. We want it to take control of that window so that it can
  // intercept subsequent fetches made in the tests.
  event.waitUntil(clients.claim());
};

let port;

onmessage = (messageEvent) => {
  [port] = messageEvent.ports;
  // If the browser puts the service worker to sleep, then on the next fetch
  // this whole script will be reevaluated and the value assigned to port will
  // no longer be present. We can't let that happen; we need a consistent port
  // throughout the tests. So we leave an event pending until the test sends a
  // message to explicitly indicate that it's done running; this ensures that
  // the browser will keep the service worker awake.
  messageEvent.waitUntil(
    new Promise((resolve) => {
      port.onmessage = resolve;
    })
  );
  // Tell the test code that the port has been set and so we're now ready to
  // receive and handle fetches.
  port.postMessage(null);
};

onfetch = async (fetchEvent) => {
  const { url, method, headers, credentials } = fetchEvent.request;
  if (!new URL(url).hostname.endsWith(".test")) {
    return;
  }
  const { port1: receiver, port2: sender } = new MessageChannel();
  fetchEvent.respondWith(
    new Promise((resolve, reject) => {
      receiver.onmessage = ({ data }) => {
        receiver.close();
        if (!data) {
          reject();
          return;
        }
        let [status, statusText, headers, body] = data;
        if (body === null) {
          // Cause any attempt to read the body to reject.
          body = new ReadableStream({
            start(controller) {
              controller.error();
            },
          });
        }
        const response = new Response(body, { status, statusText });
        // The browser adds this by default when constructing a response with a
        // body, but we want there to be no Content-Type header at all if one
        // wasn't explicitly added, since this is how real servers are treated.
        response.headers.delete("Content-Type");
        for (const [name, value] of Object.entries(headers ?? {})) {
          response.headers.append(name, value);
        }
        resolve(response);
      };
    })
  );
  port.postMessage(
    [
      url,
      method,
      [...headers.entries()],
      await fetchEvent.request.arrayBuffer(),
      credentials === "include",
    ],
    [sender]
  );
};
