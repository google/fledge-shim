/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import "jasmine";
import { clearStorageBeforeAndAfter } from "../lib/shared/testing/storage";
import { runAdAuction } from "./auction";
import { setInterestGroupAds } from "./database";

describe("runAdAuction", () => {
  clearStorageBeforeAndAfter();

  it("should return the higher-priced ad from a single interest group", async () => {
    const renderingUrl = "about:blank#1";
    await setInterestGroupAds("interest group name", [
      [renderingUrl, 0.01],
      ["about:blank#1", 0.02],
    ]);
    const token = await runAdAuction();
    expect(sessionStorage.getItem(token!)).toBe(renderingUrl);
  });

  it("should return the higher-priced ad across multiple interest groups", async () => {
    const renderingUrl = "about:blank#1";
    await setInterestGroupAds("interest group 1", [["about:blank#2", 0.01]]);
    await setInterestGroupAds("interest group 2", [[renderingUrl, 0.02]]);
    const token = await runAdAuction();
    expect(sessionStorage.getItem(token!)).toBe(renderingUrl);
  });

  it("should return null if there are no ads", async () => {
    const token = await runAdAuction();
    expect(token).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });
});
