/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import "jasmine";

import { main } from "./main";

describe("main", () => {
  it("should throw", () => {
    expect(main).toThrow();
  });
});
