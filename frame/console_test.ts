/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { logError, logWarning } from "./console";

describe("logError", () => {
  it("should log an error without associated data", () => {
    const consoleSpy = spyOnAllFunctions(console);
    logError("Message");
    expect(consoleSpy.error).toHaveBeenCalledOnceWith("[FLEDGE Shim] Message");
  });

  it("should log an error with associated data", () => {
    const consoleSpy = spyOnAllFunctions(console);
    const data = Symbol();
    logError("Message", [data]);
    expect(consoleSpy.error).toHaveBeenCalledOnceWith(
      "[FLEDGE Shim] Message",
      data
    );
  });
});

describe("logWarning", () => {
  it("should log a warning without associated data", () => {
    const consoleSpy = spyOnAllFunctions(console);
    logWarning("Message");
    expect(consoleSpy.warn).toHaveBeenCalledOnceWith("[FLEDGE Shim] Message");
  });

  it("should log a warning with associated data", () => {
    const consoleSpy = spyOnAllFunctions(console);
    const data = Symbol();
    logWarning("Message", [data]);
    expect(consoleSpy.warn).toHaveBeenCalledOnceWith(
      "[FLEDGE Shim] Message",
      data
    );
  });
});
