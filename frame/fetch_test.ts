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
import {
  FetchResult,
  FetchStatus,
  tryFetchJavaScript,
  tryFetchJson,
} from "./fetch";

describe("tryFetchJson", () => {
  const url = "https://json-endpoint.test/path";
  const body = '{"a": 1, "b": [true, null]}';
  const okResult = {
    status: FetchStatus.OK as const,
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
        headers: jasmine.objectContaining<{ [name: string]: string }>({
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
          "Content-Type": " TeXt/JsOn ; blah blah blah",
          "X-Allow-FLEDGE": "true",
        },
        body,
      })
    );
    expect(await tryFetchJson(url)).toEqual(okResult);
  });

  for (const mimeType of [
    // https://mimesniff.spec.whatwg.org/#json-mime-type
    // Chrome's behavior deviates from the spec here; it only allows +json if
    // the top-level type is application.
    "application/arbitrary+json",
    "application/json",
    "text/json",
  ]) {
    it(`should accept Content-Type: ${mimeType}`, async () => {
      setFakeServerHandler(() =>
        Promise.resolve({
          headers: {
            "Content-Type": mimeType,
            "X-Allow-FLEDGE": "true",
          },
          body,
        })
      );
      expect(await tryFetchJson(url)).toEqual(okResult);
    });
  }

  it("should return a validation error on a wrong MIME type", async () => {
    const mimeType = "text/html";
    setFakeServerHandler(() =>
      Promise.resolve({
        headers: {
          "Content-Type": mimeType,
          "X-Allow-FLEDGE": "true",
        },
        body,
      })
    );
    expect(await tryFetchJson(url)).toEqual(
      jasmine.objectContaining<FetchResult<unknown>>({
        status: FetchStatus.VALIDATION_ERROR,
        errorData: [mimeType],
      })
    );
  });

  it("should return a validation error on a missing MIME type", async () => {
    setFakeServerHandler(() =>
      Promise.resolve({
        headers: {
          "X-Allow-FLEDGE": "true",
        },
        body,
      })
    );
    expect((await tryFetchJson(url)).status).toBe(FetchStatus.VALIDATION_ERROR);
  });

  it("should accept case-insensitive X-Allow-FLEDGE", async () => {
    setFakeServerHandler(() =>
      Promise.resolve({
        headers: {
          "Content-Type": "application/json",
          "X-Allow-FLEDGE": "tRuE",
        },
        body,
      })
    );
    expect(await tryFetchJson(url)).toEqual(okResult);
  });

  it("should return a validation error on a wrong X-Allow-FLEDGE header", async () => {
    const xAllowFledge = "nope";
    setFakeServerHandler(() =>
      Promise.resolve({
        headers: {
          "Content-Type": "application/json",
          "X-Allow-FLEDGE": xAllowFledge,
        },
        body,
      })
    );
    expect(await tryFetchJson(url)).toEqual(
      jasmine.objectContaining<FetchResult<unknown>>({
        status: FetchStatus.VALIDATION_ERROR,
        errorData: [xAllowFledge],
      })
    );
  });

  it("should return a validation error on a missing MIME type", async () => {
    setFakeServerHandler(() =>
      Promise.resolve({ headers: { "Content-Type": "application/json" }, body })
    );
    expect((await tryFetchJson(url)).status).toBe(FetchStatus.VALIDATION_ERROR);
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
      status: FetchStatus.VALIDATION_ERROR,
      // Illegal character is at position 7 in the string
      errorMessage: jasmine.stringMatching(/.*\b7\b.*/),
    });
  });

  it("should handle a network error on the initial fetch", async () => {
    expect(await tryFetchJson("invalid-scheme://")).toEqual({
      status: FetchStatus.NETWORK_ERROR,
    });
  });

  it("should handle a network error when reading the body", async () => {
    setFakeServerHandler(() =>
      Promise.resolve({
        headers: {
          "Content-Type": "application/json",
          "X-Allow-FLEDGE": "true",
        },
        body: null,
      })
    );
    expect(await tryFetchJson(url)).toEqual({
      status: FetchStatus.NETWORK_ERROR,
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
      status: FetchStatus.NETWORK_ERROR,
    });
    expect(fakeServerHandler).toHaveBeenCalledOnceWith(
      jasmine.objectContaining<FakeRequest>({ url: new URL(url) })
    );
  });
});

describe("tryFetchJavaScript", () => {
  const url = "https://js-endpoint.test/path.js";
  const body = "postMessage('Hello World!')";
  const okResult = {
    status: FetchStatus.OK as const,
    value: body,
  };

  it("should fetch a script", async () => {
    const fakeServerHandler = jasmine
      .createSpy<FakeServerHandler>()
      .and.resolveTo({
        headers: {
          "Content-Type": "application/javascript",
          "X-Allow-FLEDGE": "true",
        },
        body,
      });
    setFakeServerHandler(fakeServerHandler);
    const result = await tryFetchJavaScript(url);
    expect(result).toEqual(okResult);
    expect(fakeServerHandler).toHaveBeenCalledOnceWith(
      jasmine.objectContaining<FakeRequest>({
        url: new URL(url),
        method: "GET",
        headers: jasmine.objectContaining<{ [name: string]: string }>({
          "accept": "application/javascript",
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
          "Content-Type": " TeXt/X-EcMaScRiPt ; blah blah blah",
          "X-Allow-FLEDGE": "true",
        },
        body,
      })
    );
    expect(await tryFetchJavaScript(url)).toEqual(okResult);
  });

  for (const mimeType of [
    // https://mimesniff.spec.whatwg.org/#javascript-mime-type
    "application/ecmascript",
    "application/javascript",
    "application/x-ecmascript",
    "application/x-javascript",
    "text/ecmascript",
    "text/javascript",
    "text/javascript1.0",
    "text/javascript1.1",
    "text/javascript1.2",
    "text/javascript1.3",
    "text/javascript1.4",
    "text/javascript1.5",
    "text/jscript",
    "text/livescript",
    "text/x-ecmascript",
    "text/x-javascript",
  ]) {
    it(`should accept Content-Type: ${mimeType}`, async () => {
      setFakeServerHandler(() =>
        Promise.resolve({
          headers: {
            "Content-Type": mimeType,
            "X-Allow-FLEDGE": "true",
          },
          body,
        })
      );
      expect(await tryFetchJavaScript(url)).toEqual(okResult);
    });
  }

  it("should return a validation error on a wrong MIME type", async () => {
    const mimeType = "text/html";
    setFakeServerHandler(() =>
      Promise.resolve({
        headers: {
          "Content-Type": mimeType,
          "X-Allow-FLEDGE": "true",
        },
        body,
      })
    );
    expect(await tryFetchJavaScript(url)).toEqual(
      jasmine.objectContaining<FetchResult<unknown>>({
        status: FetchStatus.VALIDATION_ERROR,
        errorData: [mimeType],
      })
    );
  });

  it("should return a validation error on a missing MIME type", async () => {
    setFakeServerHandler(() =>
      Promise.resolve({
        headers: {
          "X-Allow-FLEDGE": "true",
        },
        body,
      })
    );
    expect((await tryFetchJavaScript(url)).status).toBe(
      FetchStatus.VALIDATION_ERROR
    );
  });

  it("should accept case-insensitive X-Allow-FLEDGE", async () => {
    setFakeServerHandler(() =>
      Promise.resolve({
        headers: {
          "Content-Type": "application/javascript",
          "X-Allow-FLEDGE": "tRuE",
        },
        body,
      })
    );
    expect(await tryFetchJavaScript(url)).toEqual(okResult);
  });

  it("should return a validation error on a wrong X-Allow-FLEDGE header", async () => {
    const xAllowFledge = "nope";
    setFakeServerHandler(() =>
      Promise.resolve({
        headers: {
          "Content-Type": "application/javascript",
          "X-Allow-FLEDGE": xAllowFledge,
        },
        body,
      })
    );
    expect(await tryFetchJavaScript(url)).toEqual(
      jasmine.objectContaining<FetchResult<unknown>>({
        status: FetchStatus.VALIDATION_ERROR,
        errorData: [xAllowFledge],
      })
    );
  });

  it("should return a validation error on a missing MIME type", async () => {
    setFakeServerHandler(() =>
      Promise.resolve({
        headers: { "Content-Type": "application/javascript" },
        body,
      })
    );
    expect((await tryFetchJavaScript(url)).status).toBe(
      FetchStatus.VALIDATION_ERROR
    );
  });

  it("should handle a network error on the initial fetch", async () => {
    expect(await tryFetchJavaScript("invalid-scheme://")).toEqual({
      status: FetchStatus.NETWORK_ERROR,
    });
  });

  it("should handle a network error when reading the body", async () => {
    setFakeServerHandler(() =>
      Promise.resolve({
        headers: {
          "Content-Type": "application/javascript",
          "X-Allow-FLEDGE": "true",
        },
        body: null,
      })
    );
    expect(await tryFetchJavaScript(url)).toEqual({
      status: FetchStatus.NETWORK_ERROR,
    });
  });

  it("should return a network error on redirect and not follow it", async () => {
    const fakeServerHandler = jasmine
      .createSpy<FakeServerHandler>()
      .and.resolveTo({
        status: 302,
        headers: {
          "Location": "https://js-endpoint.test/redirected.js",
          "Content-Type": "application/javascript",
          "X-Allow-FLEDGE": "true",
        },
        body,
      });
    setFakeServerHandler(fakeServerHandler);
    expect(await tryFetchJavaScript(url)).toEqual({
      status: FetchStatus.NETWORK_ERROR,
    });
    expect(fakeServerHandler).toHaveBeenCalledOnceWith(
      jasmine.objectContaining<FakeRequest>({ url: new URL(url) })
    );
  });
});
