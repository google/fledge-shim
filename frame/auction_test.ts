/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import "jasmine";
import { nonNullish } from "../lib/shared/types";
import {
  FakeRequest,
  FakeServerHandler,
  setFakeServerHandler,
} from "../testing/http";
import { clearStorageBeforeAndAfter } from "../testing/storage";
import {
  joinedEncodedStringsMatching,
  queryParamsMatching,
} from "../testing/url";
import { runAdAuction } from "./auction";
import { setInterestGroupAds } from "./db_schema";

describe("runAdAuction", () => {
  clearStorageBeforeAndAfter();

  const renderingUrl1 = "about:blank#1";
  const renderingUrl2 = "about:blank#2";
  const hostname = "www.example.com";

  it("should return the higher-priced ad from a single interest group", async () => {
    await setInterestGroupAds("interest group name", [
      [renderingUrl1, 0.01],
      [renderingUrl2, 0.02],
    ]);
    const token = await runAdAuction(
      /* trustedScoringSignalsUrl= */ null,
      hostname
    );
    expect(sessionStorage.getItem(nonNullish(token))).toBe(renderingUrl2);
  });

  it("should return the higher-priced ad across multiple interest groups", async () => {
    await setInterestGroupAds("interest group 1", [[renderingUrl1, 0.01]]);
    await setInterestGroupAds("interest group 2", [[renderingUrl2, 0.02]]);
    const token = await runAdAuction(
      /* trustedScoringSignalsUrl= */ null,
      hostname
    );
    expect(sessionStorage.getItem(nonNullish(token))).toBe(renderingUrl2);
  });

  it("should return null if there are no ads", async () => {
    const token = await runAdAuction(
      /* trustedScoringSignalsUrl= */ null,
      hostname
    );
    expect(token).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });

  it("should return tokens in the expected format", async () => {
    await setInterestGroupAds("interest group name", [[renderingUrl1, 0.02]]);
    for (let i = 0; i < 100; i++) {
      expect(
        await runAdAuction(/* trustedScoringSignalsUrl= */ null, hostname)
      ).toMatch(/^[0-9a-f]{32}$/);
    }
  });

  const trustedScoringSignalsUrl =
    "https://trusted-server.test/scoring?extrakey=value";

  it("should fetch trusted scoring signals for ads in a single interest group", async () => {
    await setInterestGroupAds("interest group name", [
      [renderingUrl1, 0.01],
      [renderingUrl2, 0.02],
    ]);
    const fakeServerHandler = jasmine
      .createSpy<FakeServerHandler>()
      .and.resolveTo({
        headers: {
          "Content-Type": "application/json",
          "X-Allow-FLEDGE": "true",
        },
        body: '{"a": 1, "b": [true, null]}',
      });
    setFakeServerHandler(fakeServerHandler);
    await runAdAuction(trustedScoringSignalsUrl, hostname);
    expect(fakeServerHandler).toHaveBeenCalledOnceWith(
      jasmine.objectContaining<FakeRequest>({
        url: jasmine.objectContaining<URL>({
          protocol: "https:",
          host: "trusted-server.test",
          pathname: "/scoring",
          searchParams: queryParamsMatching([
            ["extrakey", "value"],
            ["hostname", hostname],
            [
              "keys",
              joinedEncodedStringsMatching(
                jasmine.arrayWithExactContents([renderingUrl1, renderingUrl2])
              ),
            ],
          ]),
        }),
        headers: jasmine.objectContaining({ "accept": "application/json" }),
        hasCredentials: false,
      })
    );
  });

  it("should fetch trusted scoring signals for ads across multiple interest groups", async () => {
    await setInterestGroupAds("interest group name", [
      [renderingUrl1, 0.01],
      [renderingUrl2, 0.02],
    ]);
    const fakeServerHandler = jasmine
      .createSpy<FakeServerHandler>()
      .and.resolveTo({
        headers: {
          "Content-Type": "application/json",
          "X-Allow-FLEDGE": "true",
        },
        body: '{"a": 1, "b": [true, null]}',
      });
    setFakeServerHandler(fakeServerHandler);
    await runAdAuction(trustedScoringSignalsUrl, hostname);
    expect(fakeServerHandler).toHaveBeenCalledOnceWith(
      jasmine.objectContaining<FakeRequest>({
        url: jasmine.objectContaining<URL>({
          protocol: "https:",
          host: "trusted-server.test",
          pathname: "/scoring",
          searchParams: queryParamsMatching([
            ["extrakey", "value"],
            ["hostname", hostname],
            [
              "keys",
              joinedEncodedStringsMatching(
                jasmine.arrayWithExactContents([renderingUrl1, renderingUrl2])
              ),
            ],
          ]),
        }),
        headers: jasmine.objectContaining({ "accept": "application/json" }),
        hasCredentials: false,
      })
    );
  });

  it("should not fetch trusted scoring signals if there are no ads", async () => {
    const fakeServerHandler = jasmine.createSpy();
    setFakeServerHandler(fakeServerHandler);
    await runAdAuction(trustedScoringSignalsUrl, hostname);
    expect(fakeServerHandler).not.toHaveBeenCalled();
  });

  it("should not fetch trusted scoring signals if no URL is provided", async () => {
    await setInterestGroupAds("interest group name", [
      [renderingUrl1, 0.01],
      [renderingUrl2, 0.02],
    ]);
    const fakeServerHandler = jasmine.createSpy();
    setFakeServerHandler(fakeServerHandler);
    await runAdAuction(/* trustedScoringSignalsUrl= */ null, hostname);
    expect(fakeServerHandler).not.toHaveBeenCalled();
  });

  it("should log to console if JSON is ill-formed", async () => {
    await setInterestGroupAds("interest group name", [
      [renderingUrl1, 0.01],
      [renderingUrl2, 0.02],
    ]);
    setFakeServerHandler(() =>
      Promise.resolve({
        headers: {
          "Content-Type": "application/json",
          "X-Allow-FLEDGE": "true",
        },
        body: '{"a": 1?}',
      })
    );
    const consoleSpy = spyOnAllFunctions(console);
    await runAdAuction(trustedScoringSignalsUrl, hostname);
    expect(consoleSpy.error).toHaveBeenCalledOnceWith(
      jasmine.stringMatching(/.*https:\/\/trusted-server\.test\/scoring.*/)
    );
    expect(consoleSpy.error).toHaveBeenCalledOnceWith(
      // Illegal character is at position 7 in the string
      jasmine.stringMatching(/.*\b7\b.*/)
    );
  });

  it("should log to console if JSON value is not an object", async () => {
    await setInterestGroupAds("interest group name", [
      [renderingUrl1, 0.01],
      [renderingUrl2, 0.02],
    ]);
    setFakeServerHandler(() =>
      Promise.resolve({
        headers: {
          "Content-Type": "application/json",
          "X-Allow-FLEDGE": "true",
        },
        body: "3",
      })
    );
    const consoleSpy = spyOnAllFunctions(console);
    await runAdAuction(trustedScoringSignalsUrl, hostname);
    expect(consoleSpy.error).toHaveBeenCalledOnceWith(
      jasmine.stringMatching(/.*https:\/\/trusted-server\.test\/scoring.*/)
    );
    expect(consoleSpy.error).toHaveBeenCalledOnceWith(
      jasmine.stringMatching(/.*\bnumber\b.*/)
    );
  });

  it("should not log to console on network error", async () => {
    await setInterestGroupAds("interest group name", [
      [renderingUrl1, 0.01],
      [renderingUrl2, 0.02],
    ]);
    const consoleSpy = spyOnAllFunctions(console);
    await runAdAuction("invalid-scheme://", hostname);
    expect(consoleSpy.error).not.toHaveBeenCalled();
  });

  it("should not log to console if trusted scoring signals are fetched successfully", async () => {
    await setInterestGroupAds("interest group name", [
      [renderingUrl1, 0.01],
      [renderingUrl2, 0.02],
    ]);
    setFakeServerHandler(() =>
      Promise.resolve({
        headers: {
          "Content-Type": "application/json",
          "X-Allow-FLEDGE": "true",
        },
        body: '{"a": 1, "b": [true, null]}',
      })
    );
    const consoleSpy = spyOnAllFunctions(console);
    await runAdAuction(trustedScoringSignalsUrl, hostname);
    expect(consoleSpy.error).not.toHaveBeenCalled();
  });

  it("should not log to console if there are no ads", async () => {
    const consoleSpy = spyOnAllFunctions(console);
    await runAdAuction(trustedScoringSignalsUrl, hostname);
    expect(consoleSpy.error).not.toHaveBeenCalled();
  });

  it("should not log to console if no URL is provided", async () => {
    await setInterestGroupAds("interest group name", [
      [renderingUrl1, 0.01],
      [renderingUrl2, 0.02],
    ]);
    const consoleSpy = spyOnAllFunctions(console);
    await runAdAuction(/* trustedScoringSignalsUrl= */ null, hostname);
    expect(consoleSpy.error).not.toHaveBeenCalled();
  });
});
