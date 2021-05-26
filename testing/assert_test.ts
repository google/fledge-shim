/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import "jasmine";
import { isArray, isObject } from "../lib/shared/guards";
import {
  assertToBeInstanceOf,
  assertToBeString,
  assertToBeTruthy,
  assertToSatisfyTypeGuard,
} from "./assert";

describe("assertToBeTruthy", () => {
  it("should do nothing on a true condition", () => {
    assertToBeTruthy(true);
    expect().nothing();
  });

  it("should do nothing on a truthy condition", () => {
    assertToBeTruthy({});
    expect().nothing();
  });

  it("should throw on a false condition", () => {
    expect(() => {
      assertToBeTruthy(false);
    }).toThrowError(TypeError, /.*\bfalse\b.*/);
  });

  it("should throw on a falsy condition", () => {
    expect(() => {
      assertToBeTruthy(null);
    }).toThrowError(TypeError, /.*\bnull\b.*/);
  });
});

describe("assertToBeString", () => {
  it("should do nothing when the argument is a string", () => {
    assertToBeString("");
    expect().nothing();
  });

  it("should throw when the argument is not a string", () => {
    expect(() => {
      assertToBeString([]);
    }).toThrowError(TypeError, /.*\bArray\b.*/);
  });

  it("should include the actual null/undefined value in the error message", () => {
    expect(() => {
      assertToBeString(undefined);
    }).toThrowError(TypeError, /.*\bundefined\b.*/);
  });
});

describe("assertToBeInstanceOf", () => {
  it("should do nothing when the argument is an instance", () => {
    assertToBeInstanceOf([], Array);
    expect().nothing();
  });

  it("should throw when the argument is not an instance", () => {
    expect(() => {
      assertToBeInstanceOf([], Date);
    }).toThrowError(TypeError, /.*\bDate\b.*/);
  });

  it("should include the actual type in the error message", () => {
    expect(() => {
      assertToBeInstanceOf({}, Array);
    }).toThrowError(TypeError, /.*\bArray\b.*/);
  });

  it("should include the actual null/undefined value in the error message", () => {
    expect(() => {
      assertToBeInstanceOf(null, Array);
    }).toThrowError(TypeError, /.*\bnull\b.*/);
  });
});

describe("assertToSatisfyTypeGuard", () => {
  it("should do nothing on a true type guard check", () => {
    assertToSatisfyTypeGuard({}, isObject);
    expect().nothing();
  });

  it("should throw on a false type guard check", () => {
    expect(() => {
      assertToSatisfyTypeGuard(undefined, isObject);
    }).toThrowError(TypeError, /.*\bisObject\b.*/);
  });

  it("should include the actual type in the error message", () => {
    expect(() => {
      assertToSatisfyTypeGuard(new Date(), isArray);
    }).toThrowError(/.*\bDate\b.*/);
  });

  it("should include the actual null/undefined value in the error message", () => {
    expect(() => {
      assertToSatisfyTypeGuard(undefined, isObject);
    }).toThrowError(/.*\bundefined\b.*/);
  });
});
