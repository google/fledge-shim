/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import "jasmine";
import * as uuid from "uuid";
import { clearStorageBeforeAndAfter } from "../../lib/shared/testing/storage";
import { assert } from "../../lib/shared/testing/types";
import { FledgeShim } from "../public_api";
import { create, renderingUrlFromAuctionResult } from "./public_api";

describe("create", () => {
  let fledgeShim: FledgeShim;
  function createOrExpectDestroyed() {
    if (fledgeShim) {
      expect(fledgeShim.isDestroyed()).toBeTrue();
    } else {
      fledgeShim = create();
      expect(fledgeShim).toBeInstanceOf(FledgeShim);
    }
  }
  it("should create on the first run", createOrExpectDestroyed);
  it("should be destroyed on the second run", createOrExpectDestroyed);

  it("should not try to re-destroy an already destroyed FledgeShim", () => {
    create().destroy();
    expect().nothing();
  });
});

describe("renderingUrlFromAuctionResult", () => {
  clearStorageBeforeAndAfter();

  it("should return the rendering URL from an auction result", async () => {
    const token = uuid.v4();
    const renderingUrl = "about:blank#ad";
    sessionStorage.setItem(token, renderingUrl);
    expect(await renderingUrlFromAuctionResult("/frame.html#" + token)).toBe(
      renderingUrl
    );
  });

  it("should clean up after itself", async () => {
    const token = uuid.v4();
    const renderingUrl = "about:blank#ad";
    sessionStorage.setItem(token, renderingUrl);
    const existingDom = document.documentElement.cloneNode(/* deep= */ true);
    assert(existingDom instanceof HTMLHtmlElement);
    await renderingUrlFromAuctionResult("/frame.html#" + token);
    expect(document.documentElement).toEqual(existingDom);
  });
});
