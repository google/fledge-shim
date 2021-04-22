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
    it("adds it to the DOM head", () => {
      const child = document.createElement("style");
      child.id = ID;
      document.head.appendChild(child);
      expect(document.getElementById(ID)).toBe(child);
      expect(child.parentNode).toBe(document.head);
    });
    it("should have cleared it away after the preceding test case", () => {
      expect(document.getElementById(ID)).toBeNull();
    });
  });

  describe("with child in body", () => {
    cleanDomAfterEach();
    it("adds it to the DOM body", () => {
      const child = document.createElement("div");
      child.id = ID;
      document.body.appendChild(child);
      expect(document.getElementById(ID)).toBe(child);
      expect(child.parentNode).toBe(document.body);
    });
    it("should have cleared it away after the preceding test case", () => {
      expect(document.getElementById(ID)).toBeNull();
    });
  });

  describe("with attribute", () => {
    cleanDomAfterEach();
    it("adds it to the DOM root", () => {
      document.documentElement.dataset["cleanDomAfterEachAttribute"] = "value";
      expect().nothing();
    });
    it("should have cleared it away after the preceding test case", () => {
      expect("cleanDomAfterEachAttribute" in document.documentElement.dataset)
        .withContext(
          `Element should not have data-clean-dom-after-each-attribute=${
            document.documentElement.dataset["cleanDomAfterEachAttribute"] ?? ""
          }`
        )
        .toBeFalse();
    });
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
