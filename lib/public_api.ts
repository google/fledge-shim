/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview The entry point for the library. All public APIs are exported
 * from here.
 */

import { awaitConnectionFromIframe } from "./connection";
import { Ad, AuctionAdConfig, InterestGroup } from "./shared/api_types";
import { awaitMessageToPort } from "./shared/messaging";
import {
  isRunAdAuctionResponse,
  messageDataFromRequest,
  RequestKind,
} from "./shared/protocol";

export { VERSION } from "./shared/version";
export { Ad, AuctionAdConfig, InterestGroup };

/**
 * A class whose instance methods correspond to the APIs exposed by FLEDGE.
 *
 * This will not exist in browser-native implementations of FLEDGE; instead, its
 * methods will be properties of `Navigator.prototype`.
 */
export class FledgeShim {
  private state: {
    readonly frameSrc: string;
    readonly iframe: HTMLIFrameElement;
    readonly portPromise: Promise<MessagePort>;
  } | null;

  /**
   * Constructor.
   *
   * This must not be called before `document.body` has been created.
   *
   * As a side effect, this creates an invisible iframe and appends it to
   * `document.body`. The iframe is an implementation detail; user code should
   * not try to interact with it.
   *
   * This will not exist in browser-native implementations of FLEDGE; instead,
   * all initialization will be performed automatically by the browser, and
   * there will be no invisible iframe.
   *
   * @param frameSrc The URL to load the FLEDGE iframe from (both the invisible
   * iframe and intermediate iframes for ad creatives). This must resolve to a
   * copy of the FLEDGE frame document from the same version of the FLEDGE Shim
   * codebase as this library.
   */
  constructor(frameSrc: string) {
    const frameUrl = absoluteUrl(frameSrc);
    if (!/^https?:$/.test(frameUrl.protocol)) {
      throw new Error("Only http: or https: URLs allowed: " + frameSrc);
    }
    if (frameUrl.hash || frameSrc.endsWith("#")) {
      throw new Error("URL fragment not allowed: " + frameSrc);
    }
    const iframe = document.createElement("iframe");
    iframe.src = frameSrc;
    iframe.style.display = "none";
    iframe.sandbox.add("allow-same-origin", "allow-scripts");
    const portPromise = awaitConnectionFromIframe(iframe, frameUrl.origin);
    document.body.appendChild(iframe);
    this.state = { frameSrc, iframe, portPromise };
  }

  private getState() {
    if (!this.state) {
      throw new Error("FledgeShim has already been destroyed");
    }
    return this.state;
  }

  /**
   * Undoes the initialization side effects of the constructor, including the
   * creation of the invisible iframe.
   *
   * After this is called, all further calls to instance methods other than
   * `isDestroyed` will throw or reject with no other effects.
   *
   * The primary purpose of this API is to facilitate hermetic testing, by
   * allowing tests to clean up after themselves after finishing. It can also be
   * used in production to free up resources that are no longer needed.
   *
   * This will not exist in browser-native implementations of FLEDGE; because
   * such implementations won't need to do any user-visible initialization,
   * there'll be no need to provide a way to undo it.
   */
  destroy(): void {
    const { iframe, portPromise } = this.getState();
    iframe.remove();
    void portPromise.then(
      (port) => {
        port.close();
      },
      () => {
        // If portPromise rejected, this will have already been surfaced
        // somewhere; don't let unhandledrejection redundantly fire again.
      }
    );
    this.state = null;
  }

  /**
   * Returns whether `destroy` has been called. If false, API methods can still
   * be called.
   *
   * This will not exist in browser-native implementations of FLEDGE, because
   * `destroy` won't either.
   */
  isDestroyed(): boolean {
    return !this.state;
  }

  /**
   * Creates or updates a registration in this browser for a specified interest
   * group and stores it client-side.
   *
   * If `group.name` is the name of an existing interest group, each of that
   * existing interest group's properties is overwritten with the corresponding
   * property from `group`, unless that property from `group` is absent or
   * `undefined`. For each property of `group` that is absent or undefined, the
   * corresponding property of the existing interest group is left unmodified.
   * If `group.name` is not the name of an existing interest group, a new
   * interest group is created.
   *
   * A consequence of this is that it's possible to create an interest group
   * with `trustedBiddingSignalsUrl: undefined`, but not to overwrite the
   * `trustedBiddingSignalsUrl` of an existing interest group with `undefined`
   * without deleting the entire interest group.
   *
   * The second parameter from the FLEDGE spec (`duration`) is not yet
   * supported.
   *
   * @see {@link InterestGroup} for further behavioral notes.
   * @see https://github.com/WICG/turtledove/blob/main/FLEDGE.md#11-joining-interest-groups
   */
  joinAdInterestGroup(group: InterestGroup): void {
    const messageData = messageDataFromRequest({
      kind: RequestKind.JOIN_AD_INTEREST_GROUP,
      group: {
        ...group,
        trustedBiddingSignalsUrl: absoluteTrustedSignalsUrl(
          group.trustedBiddingSignalsUrl
        ),
      },
    });
    void this.getState().portPromise.then(
      (port) => {
        port.postMessage(messageData);
      },
      () => {
        // If portPromise rejected, this will have already been surfaced
        // somewhere; don't let unhandledrejection redundantly fire again.
      }
    );
  }

  /**
   * Deletes an existing registration in this browser for a specified interest
   * group.
   *
   * @see {@link InterestGroup} for behavioral notes.
   * @see https://github.com/WICG/turtledove/blob/main/FLEDGE.md#11-joining-interest-groups
   */
  leaveAdInterestGroup(group: InterestGroup): void {
    const messageData = messageDataFromRequest({
      kind: RequestKind.LEAVE_AD_INTEREST_GROUP,
      group,
    });
    void this.getState().portPromise.then(
      (port) => {
        port.postMessage(messageData);
      },
      () => {
        // If portPromise rejected, this will have already been surfaced
        // somewhere; don't let unhandledrejection redundantly fire again.
      }
    );
  }

  /**
   * Runs an on-device auction and asynchronously returns a URI that can be used
   * to show the winning ad, or `null` if there is no winning ad.
   *
   * There are a number of behavioral differences between this and the
   * corresponding function in future browser-native implementations of FLEDGE.
   *
   * Because `interest_group_buyers` is not yet supported, all ads in all
   * interest groups registered from any site participate in every auction. The
   * only way for there to be no winning ad is if there are no ads in any
   * registered interest group.
   *
   * The returned URL may be used as the `src` of a standard `<iframe>` element;
   * browser-native implementations will instead return a URN requiring the use
   * of `<fencedframe>`, an API which is not yet available in browsers.
   *
   * The returned URL may be used in any window within the same
   * [page context](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage).
   * Browser-native implementations will likely instead require them to be used
   * in the same window whose `navigator` this API was called on.
   *
   * The returned URL resolves to an intermediate document that contains an
   * iframe that the ad creative is rendered into. Browser-native
   * implementations will instead resolve the returned URN directly to the ad
   * creative.
   *
   * @see {@link Ad.metadata.price} for further behavioral notes.
   * @see https://github.com/WICG/turtledove/blob/main/FLEDGE.md#21-initiating-an-on-device-auction
   */
  async runAdAuction(config: AuctionAdConfig): Promise<string | null> {
    const messageData = messageDataFromRequest({
      kind: RequestKind.RUN_AD_AUCTION,
      config: {
        ...config,
        trustedScoringSignalsUrl: absoluteTrustedSignalsUrl(
          config.trustedScoringSignalsUrl
        ),
      },
    });
    const { frameSrc, portPromise } = this.getState();
    const mainPort = await portPromise;
    const { port1: receiver, port2: sender } = new MessageChannel();
    try {
      const eventPromise = awaitMessageToPort(receiver);
      mainPort.postMessage(messageData, [sender]);
      const { data } = await eventPromise;
      if (!isRunAdAuctionResponse(data)) {
        throw new Error(
          `Malformed response: expected RunAdAuctionResponse, but received ${JSON.stringify(
            data
          )}`
        );
      }
      if (!data[0]) {
        throw new Error("Error occurred in frame; see console for details");
      }
      const [, token] = data;
      return token === null ? null : frameSrc + "#" + token;
    } finally {
      receiver.close();
    }
  }
}

function absoluteUrl(url: string) {
  try {
    return new URL(url, document.baseURI);
  } catch (error: unknown) {
    if (error instanceof TypeError) {
      throw new Error("Invalid URL: " + url);
    }
    /* istanbul ignore next */
    throw error;
  }
}

function absoluteTrustedSignalsUrl(url: string | undefined) {
  if (url === undefined) {
    return undefined;
  }
  const parsedUrl = absoluteUrl(url);
  if (parsedUrl.protocol !== "https:") {
    throw new Error("Only https: URLs allowed: " + url);
  }
  if (parsedUrl.search) {
    throw new Error("URL query string not allowed: " + url);
  }
  return parsedUrl.href;
}
