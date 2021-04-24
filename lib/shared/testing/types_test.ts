/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import "jasmine";
import { assert } from "./types";

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
