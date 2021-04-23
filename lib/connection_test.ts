/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import "jasmine";
import { awaitConnectionFromIframe } from "./connection";
import { VERSION, VERSION_KEY } from "./shared/version";
import { cleanDomAfterEach } from "./shared/testing/dom";
import {
  addMessagePortMatchers,
  postMessageFromIframeToSelf,
} from "./shared/testing/messaging";

describe("awaitConnectionFromIframe", () => {
  cleanDomAfterEach();
  beforeAll(addMessagePortMatchers);

  it("should perform the handshake and transfer a connected port", async () => {
    const iframe = document.createElement("iframe");
    document.body.appendChild(iframe);
    const portPromise = awaitConnectionFromIframe(iframe, origin);
    const { port1, port2 } = new MessageChannel();
    postMessageFromIframeToSelf(iframe, { [VERSION_KEY]: VERSION }, [port1]);
    await expectAsync(await portPromise).toBeEntangledWith(port2);
  });

  it("should reject on origin mismatch", async () => {
    const iframe = document.createElement("iframe");
    document.body.appendChild(iframe);
    const portPromise = awaitConnectionFromIframe(
      iframe,
      "https://wrong-origin.example"
    );
    postMessageFromIframeToSelf(iframe, { [VERSION_KEY]: VERSION }, [
      new MessageChannel().port1,
    ]);
    await expectAsync(portPromise).toBeRejectedWithError();
  });

  it("should reject on nullish handshake message", async () => {
    const iframe = document.createElement("iframe");
    document.body.appendChild(iframe);
    const portPromise = awaitConnectionFromIframe(iframe, origin);
    postMessageFromIframeToSelf(iframe, null, [new MessageChannel().port1]);
    await expectAsync(portPromise).toBeRejectedWithError();
  });

  it("should reject on wrong version", async () => {
    const iframe = document.createElement("iframe");
    document.body.appendChild(iframe);
    const portPromise = awaitConnectionFromIframe(iframe, origin);
    postMessageFromIframeToSelf(iframe, { [VERSION_KEY]: "wrong version" }, [
      new MessageChannel().port1,
    ]);
    await expectAsync(portPromise).toBeRejectedWithError();
  });

  it("should reject on wrong number of ports", async () => {
    const iframe = document.createElement("iframe");
    document.body.appendChild(iframe);
    const portPromise = awaitConnectionFromIframe(iframe, origin);
    postMessageFromIframeToSelf(iframe, { [VERSION_KEY]: VERSION }, []);
    await expectAsync(portPromise).toBeRejectedWithError();
  });
});
