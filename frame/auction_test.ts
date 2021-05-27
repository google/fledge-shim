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
import { storeInterestGroup } from "./db_schema";

describe("runAdAuction", () => {
  clearStorageBeforeAndAfter();

  const name = "interest group name";
  const ad1 = { renderingUrl: "about:blank#1", metadata: { price: 0.01 } };
  const ad2 = { renderingUrl: "about:blank#2", metadata: { price: 0.02 } };
  const ad3 = { renderingUrl: "about:blank#3", metadata: { price: 0.03 } };
  const ad4 = { renderingUrl: "about:blank#4", metadata: { price: 0.04 } };
  const hostname = "www.example.com";

  it("should return the higher-priced ad from a single interest group", async () => {
    await storeInterestGroup({ name, ads: [ad1, ad2] });
    const token = await runAdAuction({}, hostname);
    assertToBeString(token);
    expect(sessionStorage.getItem(token)).toBe(ad2.renderingUrl);
  });

  it("should return the higher-priced ad across multiple interest groups", async () => {
    await storeInterestGroup({ name: "interest group name 1", ads: [ad1] });
    await storeInterestGroup({ name: "interest group name 2", ads: [ad2] });
    const token = await runAdAuction({}, hostname);
    assertToBeString(token);
    expect(sessionStorage.getItem(token)).toBe(ad2.renderingUrl);
  });

  it("should return null if there are no ads", async () => {
    const result = await runAdAuction({}, hostname);
    expect(result).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });

  it("should return tokens in the expected format", async () => {
    await storeInterestGroup({ name, ads: [ad1] });
    for (let i = 0; i < 100; i++) {
      expect(await runAdAuction({}, hostname)).toMatch(/^[0-9a-f]{32}$/);
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
    await storeInterestGroup({ name, ads: [ad1, ad2] });
    const fakeServerHandler = jasmine
      .createSpy<FakeServerHandler>()
      .and.resolveTo(trustedSignalsResponse);
    setFakeServerHandler(fakeServerHandler);
    await runAdAuction({ trustedScoringSignalsUrl }, hostname);
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
    await storeInterestGroup({ name: "interest group 1", ads: [ad1] });
    await storeInterestGroup({ name: "interest group 2", ads: [ad2, ad3] });
    await storeInterestGroup({ name: "interest group 3", ads: [ad4] });
    await storeInterestGroup({ name: "interest group 4", ads: [] });
    const fakeServerHandler = jasmine
      .createSpy<FakeServerHandler>()
      .and.resolveTo(trustedSignalsResponse);
    setFakeServerHandler(fakeServerHandler);
    await runAdAuction({ trustedScoringSignalsUrl }, hostname);
    expect(fakeServerHandler).toHaveBeenCalledOnceWith(
      jasmine.objectContaining<FakeRequest>({
        url: new URL(
          trustedScoringSignalsUrl +
            "?keys=about%3Ablank%231,about%3Ablank%232,about%3Ablank%233,about%3Ablank%234"
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
    await runAdAuction({ trustedScoringSignalsUrl }, hostname);
    expect(fakeServerHandler).not.toHaveBeenCalled();
  });

  it("should not fetch trusted scoring signals if no URL is provided", async () => {
    await storeInterestGroup({ name, ads: [ad1, ad2] });
    const fakeServerHandler = jasmine.createSpy<FakeServerHandler>();
    setFakeServerHandler(fakeServerHandler);
    await runAdAuction({}, hostname);
    expect(fakeServerHandler).not.toHaveBeenCalled();
  });

  it("should log a warning and not fetch trusted scoring signals if URL is ill-formed", async () => {
    await storeInterestGroup({ name, ads: [ad1, ad2] });
    const fakeServerHandler = jasmine.createSpy<FakeServerHandler>();
    setFakeServerHandler(fakeServerHandler);
    const consoleSpy = spyOnAllFunctions(console);
    const notUrl = "This string is not a URL.";
    await runAdAuction({ trustedScoringSignalsUrl: notUrl }, hostname);
    expect(fakeServerHandler).not.toHaveBeenCalled();
    expect(consoleSpy.warn).toHaveBeenCalledOnceWith(
      jasmine.any(String),
      notUrl
    );
  });

  it("should log a warning and not fetch trusted scoring signals if URL has a query string", async () => {
    await storeInterestGroup({ name, ads: [ad1, ad2] });
    const fakeServerHandler = jasmine.createSpy<FakeServerHandler>();
    setFakeServerHandler(fakeServerHandler);
    const consoleSpy = spyOnAllFunctions(console);
    const url = trustedScoringSignalsUrl + "?key=value";
    await runAdAuction({ trustedScoringSignalsUrl: url }, hostname);
    expect(fakeServerHandler).not.toHaveBeenCalled();
    expect(consoleSpy.warn).toHaveBeenCalledOnceWith(jasmine.any(String), url);
  });

  it("should log a warning if MIME type is wrong", async () => {
    await storeInterestGroup({ name, ads: [ad1, ad2] });
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
    await runAdAuction({ trustedScoringSignalsUrl }, hostname);
    expect(consoleSpy.warn).toHaveBeenCalledOnceWith(
      jasmine.any(String),
      trustedScoringSignalsUrl + "?keys=about%3Ablank%231,about%3Ablank%232",
      jasmine.any(String),
      mimeType
    );
  });

  it("should log a warning if JSON is ill-formed", async () => {
    await storeInterestGroup({ name, ads: [ad1, ad2] });
    setFakeServerHandler(() => Promise.resolve({ headers, body: '{"a": 1?}' }));
    const consoleSpy = spyOnAllFunctions(console);
    await runAdAuction({ trustedScoringSignalsUrl }, hostname);
    expect(consoleSpy.warn).toHaveBeenCalledOnceWith(
      jasmine.any(String),
      trustedScoringSignalsUrl + "?keys=about%3Ablank%231,about%3Ablank%232",
      // Illegal character is at position 7 in the string
      jasmine.stringMatching(/.*\b7\b.*/)
    );
  });

  it("should log a warning if JSON value is not an object", async () => {
    await storeInterestGroup({ name, ads: [ad1, ad2] });
    setFakeServerHandler(() =>
      Promise.resolve({
        headers,
        body: "3",
      })
    );
    const consoleSpy = spyOnAllFunctions(console);
    await runAdAuction({ trustedScoringSignalsUrl }, hostname);
    expect(consoleSpy.warn).toHaveBeenCalledOnceWith(
      jasmine.any(String),
      trustedScoringSignalsUrl + "?keys=about%3Ablank%231,about%3Ablank%232",
      jasmine.any(String),
      3
    );
  });

  it("should not log on network error", async () => {
    await storeInterestGroup({ name, ads: [ad1, ad2] });
    const consoleSpy = spyOnAllFunctions(console);
    await runAdAuction(
      { trustedScoringSignalsUrl: "invalid-scheme://" },
      hostname
    );
    expect(consoleSpy.error).not.toHaveBeenCalled();
    expect(consoleSpy.warn).not.toHaveBeenCalled();
  });

  it("should not log if trusted scoring signals are fetched successfully", async () => {
    await storeInterestGroup({ name, ads: [ad1, ad2] });
    setFakeServerHandler(() => Promise.resolve(trustedSignalsResponse));
    const consoleSpy = spyOnAllFunctions(console);
    await runAdAuction({ trustedScoringSignalsUrl }, hostname);
    expect(consoleSpy.error).not.toHaveBeenCalled();
    expect(consoleSpy.warn).not.toHaveBeenCalled();
  });

  it("should not log if there are no ads", async () => {
    const consoleSpy = spyOnAllFunctions(console);
    await runAdAuction({ trustedScoringSignalsUrl }, hostname);
    expect(consoleSpy.error).not.toHaveBeenCalled();
    expect(consoleSpy.warn).not.toHaveBeenCalled();
  });

  it("should not log if no URL is provided", async () => {
    await storeInterestGroup({ name, ads: [ad1, ad2] });
    const consoleSpy = spyOnAllFunctions(console);
    await runAdAuction({}, hostname);
    expect(consoleSpy.error).not.toHaveBeenCalled();
    expect(consoleSpy.warn).not.toHaveBeenCalled();
  });
});
