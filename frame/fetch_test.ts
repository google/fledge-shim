/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import "jasmine";
import {
  FakeRequest,
  FakeServerHandler,
  setFakeServerHandler,
} from "../testing/http";
import { FetchJsonStatus, tryFetchJson } from "./fetch";

describe("tryFetchJson", () => {
  const url = "https://json-endpoint.test/path";
  const body = '{"a": 1, "b": [true, null]}';
  const okResult = {
    status: FetchJsonStatus.OK as const,
    value: { "a": 1, "b": [true, null] },
  };

  it("should fetch a JSON value", async () => {
    const fakeServerHandler = jasmine
      .createSpy<FakeServerHandler>()
      .and.resolveTo({
        headers: {
          "Content-Type": "application/json",
          "X-Allow-FLEDGE": "true",
        },
        body,
      });
    setFakeServerHandler(fakeServerHandler);
    const result = await tryFetchJson(url);
    expect(result).toEqual(okResult);
    expect(fakeServerHandler).toHaveBeenCalledOnceWith(
      jasmine.objectContaining<FakeRequest>({
        url: new URL(url),
        method: "GET",
        headers: jasmine.objectContaining({
          "accept": "application/json",
        }),
        body: Uint8Array.of(),
        hasCredentials: false,
      })
    );
  });

  it("should accept case-insensitive Content-Type", async () => {
    setFakeServerHandler(() =>
      Promise.resolve({
        headers: {
          "Content-Type": "TeXt/JsOn; blah blah blah",
          "X-Allow-FLEDGE": "true",
        },
        body,
      })
    );
    expect(await tryFetchJson(url)).toEqual(okResult);
  });

  it("should return a validation error on a wrong MIME type", async () => {
    setFakeServerHandler(() =>
      Promise.resolve({
        headers: {
          "Content-Type": "TeXt/JsOn; blah blah blah",
          "X-Allow-FLEDGE": "true",
        },
        body,
      })
    );
    expect(await tryFetchJson(url)).toEqual(okResult);
  });

  it("should return a validation error on a missing MIME type", async () => {
    setFakeServerHandler(() =>
      Promise.resolve({
        headers: {
          "Content-Type": "TeXt/JsOn; blah blah blah",
          "X-Allow-FLEDGE": "true",
        },
        body,
      })
    );
    expect(await tryFetchJson(url)).toEqual(okResult);
  });

  it("should return a validation error on ill-formed JSON", async () => {
    setFakeServerHandler(() =>
      Promise.resolve({
        headers: {
          "Content-Type": "application/json",
          "X-Allow-FLEDGE": "true",
        },
        body: '{"a": 1?}',
      })
    );
    expect(await tryFetchJson(url)).toEqual({
      status: FetchJsonStatus.VALIDATION_ERROR,
      // Illegal character is at position 7 in the string
      errorMessage: jasmine.stringMatching(/.*\b7\b.*/),
    });
  });

  it("should handle a network error", async () => {
    expect(await tryFetchJson("invalid-scheme://")).toEqual({
      status: FetchJsonStatus.NETWORK_ERROR,
    });
  });

  it("should return a network error on redirect and not follow it", async () => {
    const fakeServerHandler = jasmine
      .createSpy<FakeServerHandler>()
      .and.resolveTo({
        status: 302,
        headers: {
          "Location": "https://json-endpoint.test/redirected",
          "Content-Type": "application/json",
          "X-Allow-FLEDGE": "true",
        },
        body,
      });
    setFakeServerHandler(fakeServerHandler);
    expect(await tryFetchJson(url)).toEqual({
      status: FetchJsonStatus.NETWORK_ERROR,
    });
    expect(fakeServerHandler).toHaveBeenCalledOnceWith(
      jasmine.objectContaining<FakeRequest>({ url: new URL(url) })
    );
  });
});
