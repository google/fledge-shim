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

  it("should ignore messages from other windows", async () => {
    const iframe = document.createElement("iframe");
    document.body.appendChild(iframe);
    const otherIframe = document.createElement("iframe");
    document.body.appendChild(otherIframe);
    const portPromise = awaitConnectionFromIframe(iframe, origin);
    postMessageFromIframeToSelf(otherIframe, "wrong payload", []);
    await expectAsync(portPromise).toBePending();
    postMessageFromIframeToSelf(iframe, { [VERSION_KEY]: VERSION }, [
      new MessageChannel().port1,
    ]);
    await portPromise;
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

  const POSTMESSAGE_SHAREDARRAYBUFFER_SRCDOC =
    "<!DOCTYPE html><title>Helper</title><script>parent.postMessage(new SharedArrayBuffer(), '*');</script>";

  it("should ignore message errors from other windows", async () => {
    const iframe = document.createElement("iframe");
    document.body.appendChild(iframe);
    const portPromise = awaitConnectionFromIframe(iframe, origin);
    const otherIframe = document.createElement("iframe");
    otherIframe.srcdoc = POSTMESSAGE_SHAREDARRAYBUFFER_SRCDOC;
    otherIframe.sandbox.add("allow-scripts");
    document.body.appendChild(otherIframe);
    await expectAsync(portPromise).toBePending();
    postMessageFromIframeToSelf(iframe, { [VERSION_KEY]: VERSION }, [
      new MessageChannel().port1,
    ]);
    await portPromise;
  });

  it("should reject on message error", async () => {
    const iframe = document.createElement("iframe");
    iframe.srcdoc = POSTMESSAGE_SHAREDARRAYBUFFER_SRCDOC;
    iframe.sandbox.add("allow-scripts");
    const portPromise = awaitConnectionFromIframe(iframe, origin);
    document.body.appendChild(iframe);
    await expectAsync(portPromise).toBeRejectedWithError();
  });
});
