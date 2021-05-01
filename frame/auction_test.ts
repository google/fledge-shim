/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import "jasmine";
import { nonNullish } from "../lib/shared/types";
import { clearStorageBeforeAndAfter } from "../lib/shared/testing/storage";
import { runAdAuction } from "./auction";
import { setInterestGroupAds } from "./database";

describe("runAdAuction", () => {
  clearStorageBeforeAndAfter();

  it("should return the higher-priced ad from a single interest group", async () => {
    const renderingUrl = "about:blank#1";
    await setInterestGroupAds("interest group name", [
      ["about:blank#2", 0.01],
      [renderingUrl, 0.02],
    ]);
    const token = await runAdAuction();
    expect(sessionStorage.getItem(nonNullish(token))).toBe(renderingUrl);
  });

  it("should return the higher-priced ad across multiple interest groups", async () => {
    const renderingUrl = "about:blank#1";
    await setInterestGroupAds("interest group 1", [["about:blank#2", 0.01]]);
    await setInterestGroupAds("interest group 2", [[renderingUrl, 0.02]]);
    const token = await runAdAuction();
    expect(sessionStorage.getItem(nonNullish(token))).toBe(renderingUrl);
  });

  it("should return null if there are no ads", async () => {
    const token = await runAdAuction();
    expect(token).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });

  it("should return tokens in the expected format", async () => {
    await setInterestGroupAds("interest group name", [["about:blank", 0.02]]);
    for (let i = 0; i < 100; i++) {
      expect(await runAdAuction()).toMatch(/^[0-9a-f]{32}$/);
    }
  });
});
