/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import "jasmine";
import { joinedEncodedStringsMatching, queryParamsMatching } from "./url";

describe("queryParamsMatching", () => {
  const queryParams = new URLSearchParams();
  queryParams.append("key1", "value1");
  queryParams.append("key2", "value2");

  it("should match an array of entries of strings", () => {
    expect(queryParams).toEqual(
      queryParamsMatching([
        ["key1", "value1"],
        ["key2", "value2"],
      ])
    );
  });

  it("should match an array of entries of asymmetric matchers", () => {
    expect(queryParams).toEqual(
      queryParamsMatching([
        [jasmine.stringMatching(/^key1$/), jasmine.stringMatching(/^value1$/)],
        [jasmine.stringMatching(/^key2$/), jasmine.stringMatching(/^value2$/)],
      ])
    );
  });

  it("should match an asymmetric matcher", () => {
    expect(queryParams).toEqual(
      queryParamsMatching(
        jasmine.arrayWithExactContents([
          ["key1", "value1"],
          ["key2", "value2"],
        ])
      )
    );
  });

  it("should not match with an extra entry", () => {
    expect(queryParams).not.toEqual(
      queryParamsMatching([
        ["key1", "value1"],
        ["key2", "value2"],
        ["key3", "value3"],
      ])
    );
  });
});

describe("joinedEncodedStringsMatching", () => {
  const joinedEncoded = "First!,Second.,Third%3F";

  it("should match an array of strings", () => {
    expect(joinedEncoded).toEqual(
      joinedEncodedStringsMatching(["First!", "Second.", "Third?"])
    );
  });

  it("should match an array of asymmetric matchers", () => {
    expect(joinedEncoded).toEqual(
      joinedEncodedStringsMatching([
        jasmine.stringMatching(/^First!$/),
        jasmine.stringMatching(/^Second\.$/),
        jasmine.stringMatching(/^Third\?$/),
      ])
    );
  });

  it("should match an asymmetric matcher", () => {
    expect(joinedEncoded).toEqual(
      joinedEncodedStringsMatching(
        jasmine.arrayWithExactContents(["First!", "Second.", "Third?"])
      )
    );
  });

  it("should not match with an extra string", () => {
    expect(joinedEncoded).not.toEqual(
      joinedEncodedStringsMatching(["First!", "Second.", "Third?", "Fourth"])
    );
  });
});
