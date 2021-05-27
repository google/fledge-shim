/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import "jasmine";
import { FakeRequest, FakeServerHandler, setFakeServerHandler } from "./http";

describe("setFakeServerHandler", () => {
  const url = "https://domain.test/path?key=value";
  const responseBody = "response body string";

  it("should respond to a fetch request with a custom handler", async () => {
    const method = "POST";
    const requestHeaders = { "name-1": "Value-1", "name-2": "Value-2" };
    const requestBody = Uint8Array.of(1, 2, 3);
    const status = 206;
    const statusText = "Custom Status";
    const responseHeaders = { "name-3": "Value-3", "name-4": "Value-4" };
    const fakeServerHandler = jasmine
      .createSpy<FakeServerHandler>()
      .and.resolveTo({
        status,
        statusText,
        headers: responseHeaders,
        body: responseBody,
      });
    setFakeServerHandler(fakeServerHandler);
    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: requestBody,
      credentials: "include",
    });
    expect(response.ok).toBeTrue();
    expect(response.status).toBe(status);
    expect(response.statusText).toBe(statusText);
    expect(Object.fromEntries(response.headers.entries())).toEqual(
      responseHeaders
    );
    expect(await response.text()).toBe(responseBody);
    expect(fakeServerHandler).toHaveBeenCalledOnceWith(
      jasmine.objectContaining<FakeRequest>({
        url: new URL(url),
        method,
        headers:
          jasmine.objectContaining<{ [name: string]: string }>(requestHeaders),
        body: requestBody,
        hasCredentials: true,
      })
    );
  });

  it("should respond with a default empty response if not called", async () => {
    const response = await fetch(url);
    expect(response.ok).toBeTrue();
    expect(response.status).toBe(200);
    expect(response.statusText).toBe("");
    expect(Object.fromEntries(response.headers.entries())).toEqual({});
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(
      Uint8Array.of()
    );
  });

  it("should reject when attempting to read a null body", async () => {
    const status = 206;
    const statusText = "Custom Status";
    const responseHeaders = { "name-3": "Value-3", "name-4": "Value-4" };
    setFakeServerHandler(() =>
      Promise.resolve({
        status,
        statusText,
        headers: responseHeaders,
        body: null,
      })
    );
    const response = await fetch(url);
    expect(response.ok).toBeTrue();
    expect(response.status).toBe(status);
    expect(response.statusText).toBe(statusText);
    expect(Object.fromEntries(response.headers.entries())).toEqual(
      responseHeaders
    );
    await expectAsync(response.arrayBuffer()).toBeRejectedWithError(TypeError);
  });

  it("should lowercase header names", async () => {
    const headerValue = "Header value";
    const fakeServerHandler = jasmine
      .createSpy<FakeServerHandler>()
      .and.resolveTo({ headers: { "a-ReSpOnSe-HeAdEr": headerValue } });
    setFakeServerHandler(fakeServerHandler);
    const response = await fetch(url, {
      headers: { "a-ReQuEsT-hEaDeR": headerValue },
    });
    expect(Object.fromEntries(response.headers.entries())).toEqual({
      "a-response-header": headerValue,
    });
    expect(fakeServerHandler).toHaveBeenCalledOnceWith(
      jasmine.objectContaining<FakeRequest>({
        headers: jasmine.objectContaining<{ [name: string]: string }>({
          "a-request-header": headerValue,
        }),
      })
    );
  });

  for (const nth of ["first", "second"]) {
    it(`should respond with an empty body before handler is set (${nth} time)`, async () => {
      expect(await (await fetch(url)).text()).toEqual("");
      setFakeServerHandler(() => Promise.resolve({ body: responseBody }));
      expect(await (await fetch(url)).text()).toEqual(responseBody);
    });
  }

  describe("with beforeEach", () => {
    beforeEach(() => {
      setFakeServerHandler(() => Promise.resolve({ body: responseBody }));
    });
    it("should have set a handler", async () => {
      expect(await (await fetch(url)).text()).toEqual(responseBody);
    });
  });
});
