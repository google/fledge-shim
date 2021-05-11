/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import "jasmine";
import { FakeServerHandler, setFakeServerHandler } from "./http";

describe("setFakeServerHandler", () => {
  const url = "https://domain.test/path?key=value";
  const responseBody = "response body string";

  it("should respond to a fetch request with a custom handler", async () => {
    const fakeServerHandler = jasmine
      .createSpy<FakeServerHandler>()
      .and.resolveTo(responseBody);
    setFakeServerHandler(fakeServerHandler);
    const response = await fetch(url);
    expect(await response.text()).toBe(responseBody);
    expect(fakeServerHandler).toHaveBeenCalledOnceWith(new URL(url));
  });

  for (const nth of ["first", "second"]) {
    it(`should respond with an empty body before handler is set (${nth} time)`, async () => {
      expect(await (await fetch(url)).text()).toEqual("");
      setFakeServerHandler(() => Promise.resolve(responseBody));
      expect(await (await fetch(url)).text()).toEqual(responseBody);
    });
  }

  describe("with beforeEach", () => {
    beforeEach(() => {
      setFakeServerHandler(() => Promise.resolve(responseBody));
    });
    it("should have set a handler", async () => {
      expect(await (await fetch(url)).text()).toEqual(responseBody);
    });
  });
});
