/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import "jasmine";
import { errorMessage } from "./error";

describe("errorMessage", () => {
  it("should return stack trace if available", () => {
    expect(errorMessage(new RangeError("oops"))).toMatch(
      /^RangeError: oops(\n {4}at .+)+$/
    );
  });

  it("should return error message if stack trace not available", () => {
    const error = new RangeError("oops");
    delete error.stack;
    expect(errorMessage(error)).toBe("RangeError: oops");
  });

  it("should JSON-serialize non-Error objects", () => {
    expect(errorMessage({ "a": 1, "b": 2 })).toBe('{"a":1,"b":2}');
  });

  it("should stringify undefined", () => {
    expect(errorMessage(undefined)).toBe("undefined");
  });
});
