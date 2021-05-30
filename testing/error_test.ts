/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import "jasmine";
import { assertToBeTruthy } from "./assert";
import { restoreErrorHandlerAfterEach } from "./error";

describe("restoreErrorHandlerAfterEach", () => {
  describe("with custom onerror", () => {
    restoreErrorHandlerAfterEach();
    for (const nth of ["first", "second"]) {
      it(`should not already be present when setting it (${nth} time)`, async () => {
        assertToBeTruthy(onerror);
        expect(jasmine.isSpy(onerror)).toBeFalse();
        let errorHandler;
        const error = new Error("oops");
        await new Promise((resolve) => {
          errorHandler = onerror = jasmine
            .createSpy<OnErrorEventHandlerNonNull>("onerror")
            .and.callFake(resolve);
          setTimeout(() => {
            throw error;
          }, 0);
        });
        expect(errorHandler).toHaveBeenCalledOnceWith(
          "Uncaught Error: oops",
          jasmine.any(String),
          jasmine.any(Number),
          jasmine.any(Number),
          error
        );
      });
    }
  });

  describe("with beforeEach", () => {
    restoreErrorHandlerAfterEach();
    let errorHandler: jasmine.Spy<OnErrorEventHandlerNonNull>;
    let errorPromise: Promise<void>;
    beforeEach(() => {
      errorPromise = new Promise((resolve) => {
        errorHandler = onerror = jasmine
          .createSpy<OnErrorEventHandlerNonNull>("onerror")
          .and.callFake(() => {
            resolve();
          });
      });
    });
    it("should have set onerror in beforeEach", async () => {
      const error = new Error("oops");
      setTimeout(() => {
        throw error;
      }, 0);
      await errorPromise;
      expect(errorHandler).toHaveBeenCalledOnceWith(
        "Uncaught Error: oops",
        jasmine.any(String),
        jasmine.any(Number),
        jasmine.any(Number),
        error
      );
    });
  });

  describe("with afterEach", () => {
    restoreErrorHandlerAfterEach();
    let errorHandler: jasmine.Spy<OnErrorEventHandlerNonNull>;
    let errorPromise: Promise<void>;
    afterEach(async () => {
      const error = new Error("oops");
      setTimeout(() => {
        throw error;
      }, 0);
      await errorPromise;
      expect(errorHandler).toHaveBeenCalledOnceWith(
        "Uncaught Error: oops",
        jasmine.any(String),
        jasmine.any(Number),
        jasmine.any(Number),
        error
      );
    });
    it("sets onerror", () => {
      errorPromise = new Promise((resolve) => {
        errorHandler = onerror = jasmine
          .createSpy<OnErrorEventHandlerNonNull>("onerror")
          .and.callFake(() => {
            resolve();
          });
      });
      expect().nothing();
    });
  });
});
