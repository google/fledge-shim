/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Utility functions used only in test code, that facilitate
 * assertions on URLs.
 */

import "jasmine";

/**
 * Returns a Jasmine matcher that matches a `URLSearchParams` object whose
 * `entries` match the given value.
 */
export function queryParamsMatching(
  expected: jasmine.ExpectedRecursive<jasmine.ArrayLike<[string, string]>>
): jasmine.AsymmetricMatcher<URLSearchParams> {
  return {
    asymmetricMatch: (searchParams) =>
      jasmine.matchersUtil.equals(expected, [...searchParams.entries()]),
  };
}

/**
 * Returns a Jasmine matcher that matches the strings in the given value,
 * individually encoded with `encodeURIComponent` and then joined with `,`. This
 * format is used to send multiple values in a single query parameter.
 */
export function joinedEncodedStringsMatching(
  expected: jasmine.ExpectedRecursive<jasmine.ArrayLike<string>>
): jasmine.AsymmetricMatcher<string> {
  return {
    asymmetricMatch: (encodedParamValue) =>
      jasmine.matchersUtil.equals(
        expected,
        encodedParamValue.split(",").map(decodeURIComponent)
      ),
  };
}
