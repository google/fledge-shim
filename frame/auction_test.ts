/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import "jasmine";
import { assertToBeString } from "../testing/assert";
import {
  FakeRequest,
  FakeServerHandler,
  setFakeServerHandler,
} from "../testing/http";
import { clearStorageBeforeAndAfter } from "../testing/storage";
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
    assertToBeString(token);
    expect(sessionStorage.getItem(token)).toBe(renderingUrl2);
  });

  it("should return the higher-priced ad across multiple interest groups", async () => {
    await setInterestGroupAds("interest group 1", [[renderingUrl1, 0.01]]);
    await setInterestGroupAds("interest group 2", [[renderingUrl2, 0.02]]);
    const token = await runAdAuction(
      /* trustedScoringSignalsUrl= */ null,
      hostname
    );
    assertToBeString(token);
    expect(sessionStorage.getItem(token)).toBe(renderingUrl2);
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

  const trustedScoringSignalsUrl = "https://trusted-server.test/scoring";
  const headers = {
    "Content-Type": "application/json",
    "X-Allow-FLEDGE": "true",
  };
  const trustedSignalsResponse = {
    headers,
    body: '{"a": 1, "b": [true, null]}',
  };

  it("should fetch trusted scoring signals for ads in a single interest group", async () => {
    await setInterestGroupAds("interest group name", [
      [renderingUrl1, 0.01],
      [renderingUrl2, 0.02],
    ]);
    const fakeServerHandler = jasmine
      .createSpy<FakeServerHandler>()
      .and.resolveTo(trustedSignalsResponse);
    setFakeServerHandler(fakeServerHandler);
    await runAdAuction(trustedScoringSignalsUrl, hostname);
    expect(fakeServerHandler).toHaveBeenCalledOnceWith(
      jasmine.objectContaining<FakeRequest>({
        url: new URL(
          trustedScoringSignalsUrl + "?keys=about%3Ablank%231,about%3Ablank%232"
        ),
        headers: jasmine.objectContaining<{ [name: string]: string }>({
          "accept": "application/json",
        }),
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
      .and.resolveTo(trustedSignalsResponse);
    setFakeServerHandler(fakeServerHandler);
    await runAdAuction(trustedScoringSignalsUrl, hostname);
    expect(fakeServerHandler).toHaveBeenCalledOnceWith(
      jasmine.objectContaining<FakeRequest>({
        url: new URL(
          trustedScoringSignalsUrl + "?keys=about%3Ablank%231,about%3Ablank%232"
        ),
        headers: jasmine.objectContaining<{ [name: string]: string }>({
          "accept": "application/json",
        }),
        hasCredentials: false,
      })
    );
  });

  it("should not fetch trusted scoring signals if there are no ads", async () => {
    const fakeServerHandler = jasmine.createSpy<FakeServerHandler>();
    setFakeServerHandler(fakeServerHandler);
    await runAdAuction(trustedScoringSignalsUrl, hostname);
    expect(fakeServerHandler).not.toHaveBeenCalled();
  });

  it("should not fetch trusted scoring signals if no URL is provided", async () => {
    await setInterestGroupAds("interest group name", [
      [renderingUrl1, 0.01],
      [renderingUrl2, 0.02],
    ]);
    const fakeServerHandler = jasmine.createSpy<FakeServerHandler>();
    setFakeServerHandler(fakeServerHandler);
    await runAdAuction(/* trustedScoringSignalsUrl= */ null, hostname);
    expect(fakeServerHandler).not.toHaveBeenCalled();
  });

  it("should log a warning and not fetch trusted scoring signals if URL is ill-formed", async () => {
    await setInterestGroupAds("interest group name", [
      [renderingUrl1, 0.01],
      [renderingUrl2, 0.02],
    ]);
    const fakeServerHandler = jasmine.createSpy<FakeServerHandler>();
    setFakeServerHandler(fakeServerHandler);
    const consoleSpy = spyOnAllFunctions(console);
    const notUrl = "This string is not a URL.";
    await runAdAuction(notUrl, hostname);
    expect(fakeServerHandler).not.toHaveBeenCalled();
    expect(consoleSpy.warn).toHaveBeenCalledOnceWith(
      jasmine.any(String),
      notUrl
    );
  });

  it("should log a warning and not fetch trusted scoring signals if URL has a query string", async () => {
    await setInterestGroupAds("interest group name", [
      [renderingUrl1, 0.01],
      [renderingUrl2, 0.02],
    ]);
    const fakeServerHandler = jasmine.createSpy<FakeServerHandler>();
    setFakeServerHandler(fakeServerHandler);
    const consoleSpy = spyOnAllFunctions(console);
    const url = trustedScoringSignalsUrl + "?key=value";
    await runAdAuction(url, hostname);
    expect(fakeServerHandler).not.toHaveBeenCalled();
    expect(consoleSpy.warn).toHaveBeenCalledOnceWith(jasmine.any(String), url);
  });

  it("should log a warning if MIME type is wrong", async () => {
    await setInterestGroupAds("interest group name", [
      [renderingUrl1, 0.01],
      [renderingUrl2, 0.02],
    ]);
    const mimeType = "text/html";
    setFakeServerHandler(() =>
      Promise.resolve({
        headers: {
          "Content-Type": mimeType,
          "X-Allow-FLEDGE": "true",
        },
        body: '{"a": 1, "b": [true, null]}',
      })
    );
    const consoleSpy = spyOnAllFunctions(console);
    await runAdAuction(trustedScoringSignalsUrl, hostname);
    expect(consoleSpy.warn).toHaveBeenCalledOnceWith(
      jasmine.any(String),
      trustedScoringSignalsUrl + "?keys=about%3Ablank%231,about%3Ablank%232",
      jasmine.any(String),
      mimeType
    );
  });

  it("should log a warning if JSON is ill-formed", async () => {
    await setInterestGroupAds("interest group name", [
      [renderingUrl1, 0.01],
      [renderingUrl2, 0.02],
    ]);
    setFakeServerHandler(() => Promise.resolve({ headers, body: '{"a": 1?}' }));
    const consoleSpy = spyOnAllFunctions(console);
    await runAdAuction(trustedScoringSignalsUrl, hostname);
    expect(consoleSpy.warn).toHaveBeenCalledOnceWith(
      jasmine.any(String),
      trustedScoringSignalsUrl + "?keys=about%3Ablank%231,about%3Ablank%232",
      // Illegal character is at position 7 in the string
      jasmine.stringMatching(/.*\b7\b.*/)
    );
  });

  it("should log a warning if JSON value is not an object", async () => {
    await setInterestGroupAds("interest group name", [
      [renderingUrl1, 0.01],
      [renderingUrl2, 0.02],
    ]);
    setFakeServerHandler(() =>
      Promise.resolve({
        headers,
        body: "3",
      })
    );
    const consoleSpy = spyOnAllFunctions(console);
    await runAdAuction(trustedScoringSignalsUrl, hostname);
    expect(consoleSpy.warn).toHaveBeenCalledOnceWith(
      jasmine.any(String),
      trustedScoringSignalsUrl + "?keys=about%3Ablank%231,about%3Ablank%232",
      jasmine.any(String),
      3
    );
  });

  it("should not log on network error", async () => {
    await setInterestGroupAds("interest group name", [
      [renderingUrl1, 0.01],
      [renderingUrl2, 0.02],
    ]);
    const consoleSpy = spyOnAllFunctions(console);
    await runAdAuction("invalid-scheme://", hostname);
    expect(consoleSpy.error).not.toHaveBeenCalled();
    expect(consoleSpy.warn).not.toHaveBeenCalled();
  });

  it("should not log if trusted scoring signals are fetched successfully", async () => {
    await setInterestGroupAds("interest group name", [
      [renderingUrl1, 0.01],
      [renderingUrl2, 0.02],
    ]);
    setFakeServerHandler(() => Promise.resolve(trustedSignalsResponse));
    const consoleSpy = spyOnAllFunctions(console);
    await runAdAuction(trustedScoringSignalsUrl, hostname);
    expect(consoleSpy.error).not.toHaveBeenCalled();
    expect(consoleSpy.warn).not.toHaveBeenCalled();
  });

  it("should not log if there are no ads", async () => {
    const consoleSpy = spyOnAllFunctions(console);
    await runAdAuction(trustedScoringSignalsUrl, hostname);
    expect(consoleSpy.error).not.toHaveBeenCalled();
    expect(consoleSpy.warn).not.toHaveBeenCalled();
  });

  it("should not log if no URL is provided", async () => {
    await setInterestGroupAds("interest group name", [
      [renderingUrl1, 0.01],
      [renderingUrl2, 0.02],
    ]);
    const consoleSpy = spyOnAllFunctions(console);
    await runAdAuction(/* trustedScoringSignalsUrl= */ null, hostname);
    expect(consoleSpy.error).not.toHaveBeenCalled();
    expect(consoleSpy.warn).not.toHaveBeenCalled();
  });
});
