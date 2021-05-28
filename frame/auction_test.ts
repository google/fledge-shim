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
    expect(await storeInterestGroup({ name, ads: [ad1, ad2] })).toBeTrue();
    const token = await runAdAuction({}, hostname);
    assertToBeString(token);
    expect(sessionStorage.getItem(token)).toBe(ad2.renderingUrl);
  });

  it("should return the higher-priced ad across multiple interest groups", async () => {
    expect(
      await storeInterestGroup({ name: "interest group name 1", ads: [ad1] })
    ).toBeTrue();
    expect(
      await storeInterestGroup({ name: "interest group name 2", ads: [ad2] })
    ).toBeTrue();
    const token = await runAdAuction({}, hostname);
    assertToBeString(token);
    expect(sessionStorage.getItem(token)).toBe(ad2.renderingUrl);
  });

  it("should return true if there are no ads", async () => {
    const result = await runAdAuction({}, hostname);
    expect(result).toBeTrue();
    expect(sessionStorage.length).toBe(0);
  });

  it("should return tokens in the expected format", async () => {
    expect(await storeInterestGroup({ name, ads: [ad1] })).toBeTrue();
    for (let i = 0; i < 100; i++) {
      expect(await runAdAuction({}, hostname)).toMatch(/^[0-9a-f]{32}$/);
    }
  });

  const trustedBiddingSignalsUrl = "https://trusted-server.test/bidding";
  const trustedScoringSignalsUrl = "https://trusted-server.test/scoring";
  const headers = {
    "Content-Type": "application/json",
    "X-Allow-FLEDGE": "true",
  };
  const trustedSignalsResponse = {
    headers,
    body: '{"a": 1, "b": [true, null]}',
  };

  it("should fetch trusted bidding and scoring signals for ads in a single interest group", async () => {
    expect(
      await storeInterestGroup({
        name,
        trustedBiddingSignalsUrl,
        ads: [ad1, ad2],
      })
    ).toBeTrue();
    const fakeServerHandler = jasmine
      .createSpy<FakeServerHandler>()
      .and.resolveTo(trustedSignalsResponse);
    setFakeServerHandler(fakeServerHandler);
    expect(
      await runAdAuction({ trustedScoringSignalsUrl }, hostname)
    ).toBeTruthy();
    expect(fakeServerHandler).toHaveBeenCalledTimes(2);
    expect(fakeServerHandler).toHaveBeenCalledWith(
      jasmine.objectContaining<FakeRequest>({
        url: new URL(trustedBiddingSignalsUrl + "?hostname=www.example.com"),
        headers: jasmine.objectContaining<{ [name: string]: string }>({
          "accept": "application/json",
        }),
        hasCredentials: false,
      })
    );
    expect(fakeServerHandler).toHaveBeenCalledWith(
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

  it("should fetch trusted bidding and scoring signals for ads across multiple interest groups", async () => {
    expect(
      await storeInterestGroup({
        name: "interest group 1",
        trustedBiddingSignalsUrl: "https://trusted-server-1.test/bidding",
        ads: [ad1],
      })
    ).toBeTrue();
    expect(
      await storeInterestGroup({
        name: "interest group 2",
        trustedBiddingSignalsUrl: "https://trusted-server-2.test/bidding",
        ads: [ad2, ad3],
      })
    ).toBeTrue();
    expect(
      await storeInterestGroup({ name: "interest group 3", ads: [ad4] })
    ).toBeTrue();
    expect(
      await storeInterestGroup({
        name: "interest group 4",
        trustedBiddingSignalsUrl: "https://trusted-server-3.test/bidding",
        ads: [],
      })
    ).toBeTrue();
    const fakeServerHandler = jasmine
      .createSpy<FakeServerHandler>()
      .and.resolveTo(trustedSignalsResponse);
    setFakeServerHandler(fakeServerHandler);
    expect(
      await runAdAuction({ trustedScoringSignalsUrl }, hostname)
    ).toBeTruthy();
    expect(fakeServerHandler).toHaveBeenCalledTimes(3);
    expect(fakeServerHandler).toHaveBeenCalledWith(
      jasmine.objectContaining<FakeRequest>({
        url: new URL(
          "https://trusted-server-1.test/bidding?hostname=www.example.com"
        ),
        headers: jasmine.objectContaining<{ [name: string]: string }>({
          "accept": "application/json",
        }),
        hasCredentials: false,
      })
    );
    expect(fakeServerHandler).toHaveBeenCalledWith(
      jasmine.objectContaining<FakeRequest>({
        url: new URL(
          "https://trusted-server-2.test/bidding?hostname=www.example.com"
        ),
        headers: jasmine.objectContaining<{ [name: string]: string }>({
          "accept": "application/json",
        }),
        hasCredentials: false,
      })
    );
    expect(fakeServerHandler).toHaveBeenCalledWith(
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

  it("should not fetch trusted scoring signals if there are no interest groups", async () => {
    const fakeServerHandler = jasmine.createSpy<FakeServerHandler>();
    setFakeServerHandler(fakeServerHandler);
    expect(
      await runAdAuction({ trustedScoringSignalsUrl }, hostname)
    ).toBeTruthy();
    expect(fakeServerHandler).not.toHaveBeenCalled();
  });

  it("should not fetch trusted scoring signals if there are no ads in the interest groups", async () => {
    expect(
      await storeInterestGroup({ name, trustedBiddingSignalsUrl, ads: [] })
    ).toBeTrue();
    const fakeServerHandler = jasmine
      .createSpy<FakeServerHandler>()
      .and.resolveTo(trustedSignalsResponse);
    setFakeServerHandler(fakeServerHandler);
    await runAdAuction({ trustedScoringSignalsUrl }, hostname);
    expect(fakeServerHandler).not.toHaveBeenCalled();
  });

  it("should not fetch trusted scoring signals if no URL is provided", async () => {
    expect(
      await storeInterestGroup({
        name,
        trustedBiddingSignalsUrl,
        ads: [ad1, ad2],
      })
    ).toBeTrue();
    const fakeServerHandler = jasmine
      .createSpy<FakeServerHandler>()
      .and.resolveTo(trustedSignalsResponse);
    setFakeServerHandler(fakeServerHandler);
    expect(await runAdAuction({}, hostname)).toBeTruthy();
    expect(fakeServerHandler).toHaveBeenCalledOnceWith(
      jasmine.objectContaining<FakeRequest>({
        url: new URL(trustedBiddingSignalsUrl + "?hostname=www.example.com"),
        headers: jasmine.objectContaining<{ [name: string]: string }>({
          "accept": "application/json",
        }),
        hasCredentials: false,
      })
    );
  });

  it("should log a warning and not fetch trusted scoring signals if URL is ill-formed", async () => {
    await storeInterestGroup({ name, ads: [ad1, ad2] });
    const fakeServerHandler = jasmine.createSpy<FakeServerHandler>();
    setFakeServerHandler(fakeServerHandler);
    const consoleSpy = spyOnAllFunctions(console);
    const notUrl = "This string is not a URL.";
    expect(
      await runAdAuction({ trustedScoringSignalsUrl: notUrl }, hostname)
    ).toBeTruthy();
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
    expect(
      await runAdAuction({ trustedScoringSignalsUrl: url }, hostname)
    ).toBeTruthy();
    expect(fakeServerHandler).not.toHaveBeenCalled();
    expect(consoleSpy.warn).toHaveBeenCalledOnceWith(jasmine.any(String), url);
  });

  it("should log a warning if MIME type is wrong", async () => {
    expect(await storeInterestGroup({ name, ads: [ad1, ad2] })).toBeTrue();
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
    expect(
      await runAdAuction({ trustedScoringSignalsUrl }, hostname)
    ).toBeTruthy();
    expect(consoleSpy.warn).toHaveBeenCalledOnceWith(
      jasmine.any(String),
      trustedScoringSignalsUrl + "?keys=about%3Ablank%231,about%3Ablank%232",
      jasmine.any(String),
      mimeType
    );
  });

  it("should log a warning if JSON is ill-formed", async () => {
    expect(await storeInterestGroup({ name, ads: [ad1, ad2] })).toBeTrue();
    setFakeServerHandler(() => Promise.resolve({ headers, body: '{"a": 1?}' }));
    const consoleSpy = spyOnAllFunctions(console);
    expect(
      await runAdAuction({ trustedScoringSignalsUrl }, hostname)
    ).toBeTruthy();
    expect(consoleSpy.warn).toHaveBeenCalledOnceWith(
      jasmine.any(String),
      trustedScoringSignalsUrl + "?keys=about%3Ablank%231,about%3Ablank%232",
      // Illegal character is at position 7 in the string
      jasmine.stringMatching(/.*\b7\b.*/)
    );
  });

  it("should log a warning if JSON value is not an object", async () => {
    expect(await storeInterestGroup({ name, ads: [ad1, ad2] })).toBeTrue();
    setFakeServerHandler(() =>
      Promise.resolve({
        headers,
        body: "3",
      })
    );
    const consoleSpy = spyOnAllFunctions(console);
    expect(
      await runAdAuction({ trustedScoringSignalsUrl }, hostname)
    ).toBeTruthy();
    expect(consoleSpy.warn).toHaveBeenCalledOnceWith(
      jasmine.any(String),
      trustedScoringSignalsUrl + "?keys=about%3Ablank%231,about%3Ablank%232",
      jasmine.any(String),
      3
    );
  });

  it("should not log on network error", async () => {
    expect(await storeInterestGroup({ name, ads: [ad1, ad2] })).toBeTrue();
    const consoleSpy = spyOnAllFunctions(console);
    expect(
      await runAdAuction(
        { trustedScoringSignalsUrl: "invalid-scheme://" },
        hostname
      )
    ).toBeTruthy();
    expect(consoleSpy.error).not.toHaveBeenCalled();
    expect(consoleSpy.warn).not.toHaveBeenCalled();
  });

  it("should not log if trusted bidding and scoring signals are fetched successfully", async () => {
    expect(
      await storeInterestGroup({
        name,
        trustedBiddingSignalsUrl,
        ads: [ad1, ad2],
      })
    ).toBeTrue();
    setFakeServerHandler(() => Promise.resolve(trustedSignalsResponse));
    const consoleSpy = spyOnAllFunctions(console);
    expect(
      await runAdAuction({ trustedScoringSignalsUrl }, hostname)
    ).toBeTruthy();
    expect(consoleSpy.error).not.toHaveBeenCalled();
    expect(consoleSpy.warn).not.toHaveBeenCalled();
  });

  it("should not log if there are no ads", async () => {
    const consoleSpy = spyOnAllFunctions(console);
    expect(
      await runAdAuction({ trustedScoringSignalsUrl }, hostname)
    ).toBeTruthy();
    expect(consoleSpy.error).not.toHaveBeenCalled();
    expect(consoleSpy.warn).not.toHaveBeenCalled();
  });

  it("should not log if no URL is provided", async () => {
    expect(await storeInterestGroup({ name, ads: [ad1, ad2] })).toBeTrue();
    const consoleSpy = spyOnAllFunctions(console);
    expect(await runAdAuction({}, hostname)).toBeTruthy();
    expect(consoleSpy.error).not.toHaveBeenCalled();
    expect(consoleSpy.warn).not.toHaveBeenCalled();
  });
});
