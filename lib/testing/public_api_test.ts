/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import "jasmine";
import { assert } from "../../lib/shared/types";
import { clearStorageBeforeAndAfter } from "../../lib/shared/testing/storage";
import { FledgeShim } from "../public_api";
import { create, renderingUrlFromAuctionResult } from "./public_api";

describe("create", () => {
  let fledgeShim: FledgeShim;
  it("should return a FledgeShim", () => {
    fledgeShim = create();
    expect(fledgeShim).toBeInstanceOf(FledgeShim);
  });
  afterAll(() => {
    expect(fledgeShim.isDestroyed()).toBeTrue();
  });

  it("should not try to re-destroy an already destroyed FledgeShim", () => {
    create().destroy();
    expect().nothing();
  });
});

describe("renderingUrlFromAuctionResult", () => {
  clearStorageBeforeAndAfter();

  const token = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const renderingUrl = "about:blank#ad";

  it("should return the rendering URL from an auction result", async () => {
    sessionStorage.setItem(token, renderingUrl);
    expect(await renderingUrlFromAuctionResult("/frame.html#" + token)).toBe(
      renderingUrl
    );
  });

  it("should clean up after itself", async () => {
    sessionStorage.setItem(token, renderingUrl);
    const existingDom = document.documentElement.cloneNode(/* deep= */ true);
    assert(existingDom instanceof HTMLHtmlElement);
    await renderingUrlFromAuctionResult("/frame.html#" + token);
    expect(document.documentElement).toEqual(existingDom);
  });
});
