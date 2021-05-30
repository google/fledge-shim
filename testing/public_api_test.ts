/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import "jasmine";
import { FledgeShim } from "../lib/public_api";
import { assertToBeInstanceOf } from "./assert";
import { create, renderUrlFromAuctionResult } from "./public_api";
import { clearStorageBeforeAndAfter } from "./storage";

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

describe("renderUrlFromAuctionResult", () => {
  clearStorageBeforeAndAfter();

  const token = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const renderUrl = "about:blank#ad";

  it("should return the rendering URL from an auction result", async () => {
    sessionStorage.setItem(token, renderUrl);
    expect(await renderUrlFromAuctionResult("/frame.html#" + token)).toBe(
      renderUrl
    );
  });

  it("should clean up after itself", async () => {
    sessionStorage.setItem(token, renderUrl);
    const existingDom = document.documentElement.cloneNode(/* deep= */ true);
    assertToBeInstanceOf(existingDom, HTMLHtmlElement);
    await renderUrlFromAuctionResult("/frame.html#" + token);
    expect(document.documentElement).toEqual(existingDom);
  });
});
