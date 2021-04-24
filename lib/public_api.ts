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
import { awaitMessageToPort } from "./shared/messaging";
import {
  FledgeRequest,
  isRunAdAuctionResponse,
  RequestTag,
} from "./shared/protocol";

export { VERSION } from "./shared/version";

// The FLEDGE spec uses snake_case property names.
/* eslint-disable camelcase */

/**
 * An ad creative that can participate in an auction and later be rendered onto
 * the page if it wins.
 *
 * The properties of this type aren't actually specified in the FLEDGE spec at
 * present; they are our best guess as to how this will work, and may be
 * replaced later with a different API.
 */
export interface Ad {
  /**
   * The URL where the actual creative is hosted. This will be used as the `src`
   * of an iframe that will appear on the page if this ad wins.
   */
  rendering_url: string;
  /** Additional metadata about this ad that can be read by the auction. */
  metadata: {
    /**
     * The amount that the buyer is willing to pay in order to have this ad
     * selected. The ad with the highest price is selected; in case of a tie, an
     * ad with the highest price is selected arbitrarily (based on idb-keyval
     * implementation details).
     *
     * This is used by our temporary hardcoded auction logic and will not exist
     * in browser-native implementations of FLEDGE (in which auction logic, and
     * the structure and semantics of ad metadata, will be user-defined).
     *
     * The precise meaning of this value (what currency it's in, CPM vs. CPC,
     * etc.) is a matter of convention among buyers and sellers. The current
     * implementation requires the entire ecosystem to adopt a uniform
     * convention, which is impractical, but future implementations will allow
     * sellers to choose which buyers to transact with, which will allow them to
     * deal only with buyers with whom they've made out-of-band agreements that
     * specify the meaning.
     */
    price: number;
  };
}

/**
 * TODO
 */
export interface InterestGroupIdentity {
  /** TODO */
  name: string;
}

/**
 * TODO
 */
export interface InterestGroup extends InterestGroupIdentity {
  /**
   * Ads to be entered into the auction for impressions that this interest group
   * is permitted to bid on.
   */
  ads: Ad[];
}

/* eslint-enable camelcase */

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
    const frameUrl = new URL(frameSrc, document.baseURI);
    if (!/^https?:$/.test(frameUrl.protocol)) {
      throw new Error("frameSrc must be a http: or https: URL");
    }
    if (frameUrl.hash || frameSrc.endsWith("#")) {
      throw new Error("frameSrc must not have a fragment");
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
   * Creates a new registration in this browser for a specified interest group
   * and stores it client-side.
   *
   * The second parameter from the FLEDGE spec (`duration`) is not yet
   * supported.
   *
   * @see {@link InterestGroup} for further behavioral notes.
   * @see https://github.com/WICG/turtledove/blob/main/FLEDGE.md#11-joining-interest-groups
   */
  joinAdInterestGroup(group: InterestGroup): void {
    const request: FledgeRequest = [
      RequestTag.JOIN_AD_INTEREST_GROUP,
      [
        group.name,
        group.ads.map((ad) => [ad.rendering_url, ad.metadata.price]),
      ],
    ];
    void this.getState().portPromise.then(
      (port) => {
        port.postMessage(request);
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
  leaveAdInterestGroup(group: InterestGroupIdentity): void {
    const request: FledgeRequest = [
      RequestTag.LEAVE_AD_INTEREST_GROUP,
      group.name,
    ];
    void this.getState().portPromise.then(
      (port) => {
        port.postMessage(request);
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
  async runAdAuction(): Promise<string | null> {
    const request: FledgeRequest = [RequestTag.RUN_AD_AUCTION, null];
    const { frameSrc, portPromise } = this.getState();
    const mainPort = await portPromise;
    const { port1: receiver, port2: sender } = new MessageChannel();
    try {
      const eventPromise = awaitMessageToPort(receiver);
      mainPort.postMessage(request, [sender]);
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
