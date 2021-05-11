/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import "jasmine";
import {
  FakeServerHandler,
  setFakeServerHandler,
} from "../lib/shared/testing/http";
import { FetchJsonStatus, tryFetchJson } from "./fetch";

describe("tryFetchJson", () => {
  const url = "https://json-endpoint.test/path";

  it("should fetch a JSON value", async () => {
    const fakeServerHandler = jasmine
      .createSpy<FakeServerHandler>()
      .and.resolveTo('{"a": 1, "b": [true, null]}');
    setFakeServerHandler(fakeServerHandler);
    const result = await tryFetchJson(url);
    expect(result).toEqual({
      status: FetchJsonStatus.OK,
      value: { "a": 1, "b": [true, null] },
    });
    expect(fakeServerHandler).toHaveBeenCalledOnceWith(new URL(url));
  });

  it("should handle ill-formed JSON", async () => {
    const fakeServerHandler = jasmine
      .createSpy<FakeServerHandler>()
      .and.resolveTo('{"a": 1?}');
    setFakeServerHandler(fakeServerHandler);
    const result = await tryFetchJson(url);
    expect(result).toEqual({
      status: FetchJsonStatus.JSON_PARSE_ERROR,
      // Illegal character is at position 7 in the string
      errorMessage: jasmine.stringMatching(/.*\b7\b.*/),
    });
    expect(fakeServerHandler).toHaveBeenCalledOnceWith(new URL(url));
  });

  it("should handle a network error", async () => {
    expect(await tryFetchJson("invalid-scheme://")).toEqual({
      status: FetchJsonStatus.NETWORK_ERROR,
    });
  });
});
