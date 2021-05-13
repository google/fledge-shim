/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import "jasmine";
import {
  isJoinAdInterestGroupRequest,
  isLeaveAdInterestGroupRequest,
  isRunAdAuctionRequest,
  isRunAdAuctionResponse,
} from "./protocol";

for (const { name, guard, trueExamples, falseExamples } of [
  {
    name: "isJoinAdInterestGroupRequest",
    guard: isJoinAdInterestGroupRequest,
    trueExamples: [
      ["", []],
      [
        "interest group name",
        [
          ["https://ad.example/1", 0.02],
          ["https://ad.example/2", 0.04],
        ],
      ],
    ],
    falseExamples: [
      undefined,
      [],
      [
        "interest group name",
        [
          ["https://ad.example/1", 0.02],
          ["https://ad.example/2", 0.04],
        ],
        null,
      ],
      [true, []],
      ["interest group name", 3],
      ["interest group name", ["bad"]],
      ["interest group name", [["https://ad.example/1", 0.02], []]],
      [
        "interest group name",
        [
          ["https://ad.example/1", 0.02, []],
          ["https://ad.example/2", 0.04],
        ],
      ],
      ["interest group name", [[{}, 0.04]]],
      [
        "interest group name",
        [
          ["https://ad.example/1", 0.02],
          ["https://ad.example/2", undefined],
        ],
      ],
    ],
  },
  {
    name: "isLeaveAdInterestGroupRequest",
    guard: isLeaveAdInterestGroupRequest,
    trueExamples: ["", "interest group name"],
    falseExamples: [null, true],
  },
  {
    name: "isRunAdAuctionRequest",
    guard: isRunAdAuctionRequest,
    trueExamples: [null, "https://trusted-server.example/endpoint"],
    falseExamples: [3, true],
  },
  {
    name: "isRunAdAuctionResponse",
    guard: isRunAdAuctionResponse,
    trueExamples: [[true, null], [true, "token"], [false]],
    falseExamples: [{}, [], ["token", []], [true], [false, undefined]],
  },
]) {
  describe(name, () => {
    for (const example of trueExamples) {
      it(`should return true for ${JSON.stringify(example)}`, () => {
        expect(guard(example)).toBeTrue();
      });
    }
    for (const example of falseExamples) {
      it(`should return false for ${JSON.stringify(example)}`, () => {
        expect(guard(example)).toBeFalse();
      });
    }
  });
}
