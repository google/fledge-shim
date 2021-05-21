/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import "jasmine";
import {
  assert,
  assertInstance,
  assertionError,
  assertType,
  isArray,
  isKeyValueObject,
  isObject,
  nonNullish,
} from "./types";

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

describe("assertionError", () => {
  it("should return a different error on each call", () => {
    const error1 = assertionError();
    const error2 = assertionError();
    expect(error1.stack).not.toBe(error2.stack);
  });
});

describe("assert", () => {
  it("should do nothing on a true condition", () => {
    assert(true);
    expect().nothing();
  });

  it("should throw on a false condition", () => {
    expect(() => {
      assert(false);
    }).toThrowError();
  });
});

describe("assertType", () => {
  it("should do nothing on a true type guard check", () => {
    assertType({}, isObject);
    expect().nothing();
  });

  it("should throw on a false type guard check", () => {
    expect(() => {
      assertType(undefined, isObject);
    }).toThrowError();
  });

  it("should include the JSON-stringified value in the error message", () => {
    expect(() => {
      assertType({ a: 1, b: 2 }, isArray);
    }).toThrowMatching(
      (error) =>
        error instanceof Error && error.message.endsWith('{"a":1,"b":2}')
    );
  });
});

describe("assertInstance", () => {
  it("should do nothing when the argument is an instance", () => {
    assertInstance([], Array);
    expect().nothing();
  });

  it("should throw on a false type guard check", () => {
    expect(() => {
      assertInstance([], Date);
    }).toThrowError();
  });

  it("should include the JSON-stringified value in the error message", () => {
    expect(() => {
      assertInstance({ a: 1, b: 2 }, Date);
    }).toThrowMatching(
      (error) =>
        error instanceof Error && error.message.endsWith('{"a":1,"b":2}')
    );
  });
});

describe("nonNullish", () => {
  it("should return a non-nullish value", () => {
    const value = {};
    expect(nonNullish(value)).toBe(value);
  });

  it("should throw on null", () => {
    expect(() => {
      nonNullish(null);
    }).toThrowError();
  });

  it("should throw on undefined", () => {
    expect(() => {
      nonNullish(undefined);
    }).toThrowError();
  });
});
