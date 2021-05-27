/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import "jasmine";
import { isArray, isKeyValueObject, isObject } from "./guards";

describe("isObject", () => {
  it("should return true for {}", () => {
    expect(isObject({})).toBeTrue();
  });
  it("should return true for []", () => {
    expect(isObject([])).toBeTrue();
  });
  it("should return true for function", () => {
    expect(isObject(() => null)).toBeTrue();
  });
  it("should return true for Date", () => {
    expect(isObject(new Date())).toBeTrue();
  });
  it("should return false for null", () => {
    expect(isObject(null)).toBeFalse();
  });
  it("should return false for undefined", () => {
    expect(isObject(undefined)).toBeFalse();
  });
});

describe("isKeyValueObject", () => {
  it("should return true for {}", () => {
    expect(isKeyValueObject({})).toBeTrue();
  });
  it("should return false for []", () => {
    expect(isKeyValueObject([])).toBeFalse();
  });
  it("should return false for function", () => {
    expect(isKeyValueObject(() => null)).toBeFalse();
  });
  it("should return false for Date", () => {
    expect(isKeyValueObject(new Date())).toBeFalse();
  });
  it("should return false for null", () => {
    expect(isKeyValueObject(null)).toBeFalse();
  });
  it("should return false for undefined", () => {
    expect(isKeyValueObject(undefined)).toBeFalse();
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
