/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import "jasmine";
import { isArray, isObject } from "./types";

describe("isObject", () => {
  it("should return true for {}", () => {
    expect(isObject({})).toBeTrue();
  });
  it("should return false for null", () => {
    expect(isObject(null)).toBeFalse();
  });
  it("should return false for undefined", () => {
    expect(isObject(undefined)).toBeFalse();
  });
});

describe("isArray", () => {
  it("should return true for []", () => {
    expect(isArray([])).toBeTrue();
  });
  it("should return false for {}}", () => {
    expect(isArray({})).toBeFalse();
  });
});
