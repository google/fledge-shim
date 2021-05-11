/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import "jasmine";
import { cleanDomAfterEach } from "./dom";

const ID = "clean-dom-after-each-child";

describe("cleanDomAfterEach", () => {
  describe("with child in head", () => {
    cleanDomAfterEach();
    for (const nth of ["first", "second"]) {
      it(`should not already be present when adding it (${nth} time)`, () => {
        expect(document.getElementById(ID)).toBeNull();
        const child = document.createElement("style");
        child.id = ID;
        document.head.appendChild(child);
        expect(document.getElementById(ID)).toBe(child);
        expect(child.parentNode).toBe(document.head);
      });
    }
  });

  describe("with child in body", () => {
    cleanDomAfterEach();
    for (const nth of ["first", "second"]) {
      it(`should not already be present when adding it (${nth} time)`, () => {
        expect(document.getElementById(ID)).toBeNull();
        const child = document.createElement("div");
        child.id = ID;
        document.body.appendChild(child);
        expect(document.getElementById(ID)).toBe(child);
        expect(child.parentNode).toBe(document.body);
      });
    }
  });

  describe("with attribute on DOM root", () => {
    cleanDomAfterEach();
    for (const nth of ["first", "second"]) {
      it(`should not already be present when adding it (${nth} time)`, () => {
        expect("cleanDomAfterEachAttribute" in document.documentElement.dataset)
          .withContext(
            `Element should not have data-clean-dom-after-each-attribute=${
              document.documentElement.dataset["cleanDomAfterEachAttribute"] ??
              ""
            }`
          )
          .toBeFalse();
        document.documentElement.dataset["cleanDomAfterEachAttribute"] =
          "value";
      });
    }
  });

  describe("with beforeEach", () => {
    cleanDomAfterEach();
    let child: HTMLDivElement;
    beforeEach(() => {
      child = document.createElement("div");
      child.id = ID;
      document.body.appendChild(child);
    });
    it("should have added it to the DOM body in beforeEach", () => {
      expect(document.getElementById(ID)).toBe(child);
    });
  });

  describe("with afterEach", () => {
    cleanDomAfterEach();
    let child: HTMLDivElement;
    afterEach(() => {
      expect(document.getElementById(ID)).toBe(child);
    });
    it("adds it to the DOM body", () => {
      child = document.createElement("div");
      child.id = ID;
      document.body.appendChild(child);
      expect().nothing();
    });
  });
});
