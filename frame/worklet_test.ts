/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { assertToBeTruthy } from "../testing/assert";
import { setFakeServerHandler } from "../testing/http";
import { runBiddingScript, runScoringScript } from "./worklet";

describe("runBiddingScript", () => {
  const group = {
    name: "interest group name",
    biddingLogicUrl: "https://dsp.test/bidder.js",
    trustedBiddingSignalsUrl: "https://trusted-server.test/bidding",
    ads: [
      { renderUrl: "about:blank#1", metadata: { "price": 0.01 } },
      { renderUrl: "about:blank#2", metadata: { "price": 0.02 } },
    ],
  };

  it("should run a bidding script", async () => {
    expect(
      await runBiddingScript(
        [
          "function generateBid({",
          "  name,",
          "  biddingLogicUrl,",
          "  trustedBiddingSignalsUrl,",
          "  ads,",
          "}) {",
          "  if (",
          "    !(",
          "      name === 'interest group name' &&",
          "      biddingLogicUrl === 'https://dsp.test/bidder.js' &&",
          "      trustedBiddingSignalsUrl ===",
          "        'https://trusted-server.test/bidding' &&",
          "      ads.length === 2 &&",
          "      ads[0].renderUrl === 'about:blank#1' &&",
          "      ads[0].metadata['price'] === 0.01 &&",
          "      ads[1].renderUrl === 'about:blank#2' &&",
          "      ads[1].metadata['price'] === 0.02 &&",
          "      origin === 'null'",
          "    )",
          "  ) {",
          "    throw new Error();",
          "  }",
          "  return { ad: null, bid: 0.03, render: 'about:blank#2' };",
          "}",
        ].join("\n"),
        group,
        /* extraScript= */ ""
      )
    ).toEqual({ adJson: "null", bid: 0.03, render: "about:blank#2" });
  });

  for (const { expression, adJson } of [
    { expression: "null", adJson: "null" },
    { expression: "true", adJson: "true" },
    { expression: "3", adJson: "3" },
    { expression: "'abc'", adJson: '"abc"' },
    { expression: "[]", adJson: "[]" },
    { expression: "{}", adJson: "{}" },
    { expression: "[undefined]", adJson: "[null]" },
    { expression: "[null]", adJson: "[null]" },
    { expression: "[Symbol.iterator]", adJson: "[null]" },
    { expression: "[() => {}]", adJson: "[null]" },
    { expression: "/abc/", adJson: "{}" },
    { expression: "new (class {})()", adJson: "{}" },
    {
      expression: "new (class { toJSON() { return 'abc'; } })()",
      adJson: '"abc"',
    },
  ]) {
    it(`should JSON-serialize ${expression}`, async () => {
      const bidData = await runBiddingScript(
        [
          "function generateBid() {",
          `  const ad = ${expression};`,
          "  return { ad, bid: 0.03, render: 'about:blank#2' };",
          "}",
        ].join("\n"),
        group,
        /* extraScript= */ ""
      );
      assertToBeTruthy(bidData);
      expect(bidData.adJson).toBe(adJson);
    });
  }

  it("should ignore monkeypatching of built-in properties", async () => {
    expect(
      await runBiddingScript(
        [
          "for (const { obj, property } of [",
          "  { obj: WorkerGlobalScope.prototype, property: 'self' },",
          "  { obj: globalThis, property: 'postMessage' },",
          "  { obj: console, property: 'warn' },",
          "]) {",
          "  Object.defineProperty(obj, property, {",
          "    get() {",
          "      throw new Error();",
          "    },",
          "  });",
          "}",
          "function generateBid() {",
          "  return { ad: null, bid: 0.03, render: 'about:blank#2' };",
          "}",
        ].join("\n"),
        group,
        /* extraScript= */ ""
      )
    ).toEqual({ adJson: "null", bid: 0.03, render: "about:blank#2" });
  });

  for (const { condition, biddingScript, warningData } of [
    {
      condition: "generateBid is the wrong type",
      biddingScript: "generateBid = true;",
      warningData: "true",
    },
    {
      condition: "generateBid returns nullish",
      biddingScript: "function generateBid() { return null; }",
      warningData: "null",
    },
    {
      condition: "ad is undefined",
      biddingScript: [
        "function generateBid() {",
        "  return { bid: 0.03, render: 'about:blank#2' };",
        "}",
      ].join("\n"),
      warningData: "[object Object]",
    },
    {
      condition: "ad is a symbol",
      biddingScript: [
        "function generateBid() {",
        "  return { ad: Symbol.iterator, bid: 0.03, render: 'about:blank#2' };",
        "}",
      ].join("\n"),
      warningData: "[object Object]",
    },
    {
      condition: "ad is a function",
      biddingScript: [
        "function generateBid() {",
        "  return { ad() {}, bid: 0.03, render: 'about:blank#2' };",
        "}",
      ].join("\n"),
      warningData: "[object Object]",
    },
    {
      condition: "ad is circular",
      biddingScript: [
        "function generateBid() {",
        "  const ad = {};",
        "  ad.prop = ad;",
        "  return { ad, bid: 0.03, render: 'about:blank#2' };",
        "}",
      ].join("\n"),
      warningData: jasmine.stringMatching(/^TypeError: .*/),
    },
    {
      condition: "bid is the wrong type",
      biddingScript: [
        "function generateBid() {",
        "  return { ad: null, bid: 'nope', render: 'about:blank#2' };",
        "}",
      ].join("\n"),
      warningData: "[object Object]",
    },
    {
      condition: "render is the wrong type",
      biddingScript: [
        "function generateBid() {",
        "  return { ad: null, bid: 0.03, render: 42 };",
        "}",
      ].join("\n"),
      warningData: "[object Object]",
    },
    {
      condition: "top-level script throws",
      biddingScript: "throw new Error('Oops');",
      warningData: "Error: Oops",
    },
    {
      condition: "generateBid throws",
      biddingScript: [
        "function generateBid() {",
        "  throw new Error('Oops');",
        "}",
      ].join("\n"),
      warningData: "Error: Oops",
    },
    {
      condition: "generateBid property access throws",
      biddingScript: [
        "Object.defineProperty(globalThis, 'generateBid', {",
        "  get() {",
        "    throw new Error('Oops');",
        "  }",
        "});",
      ].join("\n"),
      warningData: "Error: Oops",
    },
    {
      condition: "ad property access throws",
      biddingScript: [
        "function generateBid() {",
        "  return {",
        "    get ad() {",
        "      throw new Error('Oops');",
        "    },",
        "    bid: 0.03,",
        "    render: 'about:blank#2',",
        "  };",
        "}",
      ].join("\n"),
      warningData: "Error: Oops",
    },
    {
      condition: "bid property access throws",
      biddingScript: [
        "function generateBid() {",
        "  return {",
        "    ad: null,",
        "    get bid() {",
        "      throw new Error('Oops');",
        "    },",
        "    render: 'about:blank#2',",
        "  };",
        "}",
      ].join("\n"),
      warningData: "Error: Oops",
    },
    {
      condition: "render property access throws",
      biddingScript: [
        "function generateBid() {",
        "  return {",
        "    ad: null,",
        "    bid: 0.03,",
        "    get render() {",
        "      throw new Error('Oops');",
        "    },",
        "  };",
        "}",
      ].join("\n"),
      warningData: "Error: Oops",
    },
    {
      condition: "script tries to postMessage",
      biddingScript: [
        "postMessage([null]);",
        "function generateBid() {",
        "  return { ad: null, bid: 0.03, render: 'about:blank#2' };",
        "}",
      ].join("\n"),
      warningData: jasmine.stringMatching(/^ReferenceError: .*/),
    },
  ]) {
    it(`should log a warning and drop the bid if ${condition}`, async () => {
      const warningPromise = new Promise((resolve) => {
        setFakeServerHandler(({ body }) => {
          resolve(JSON.parse(new TextDecoder().decode(body)));
          return Promise.resolve({});
        });
      });
      expect(
        await runBiddingScript(
          biddingScript,
          group,
          [
            "console.warn = (...args) => {",
            "  void fetch('https://warning.test', {",
            "    method: 'POST',",
            "    body: JSON.stringify(args.map(String)),",
            "    keepalive: true,",
            "  });",
            "};",
          ].join("\n")
        )
      ).toBeNull();
      expect(await warningPromise).toEqual([jasmine.any(String), warningData]);
    });
  }
});

describe("runScoringScript", () => {
  const config = {
    decisionLogicUrl: "https://ssp.test/scorer.js",
  };

  it("should run a scoring script with trusted scoring signals", async () => {
    expect(
      await runScoringScript(
        [
          "function scoreAd(",
          "  adMetadata,",
          "  bid,",
          "  { decisionLogicUrl, trustedScoringSignalsUrl },",
          ") {",
          "  if (",
          "    !(",
          "      adMetadata['arbitraryKey'] === 'arbitrary value' &&",
          "      bid === 0.02 &&",
          "      decisionLogicUrl === 'https://ssp.test/scorer.js' &&",
          "      trustedScoringSignalsUrl ===",
          "        'https://trusted-server.test/scoring' &&",
          "      origin === 'null'",
          "    )",
          "  ) {",
          "    throw new Error();",
          "  }",
          "  return 10;",
          "}",
        ].join("\n"),
        '{"arbitraryKey":"arbitrary value"}',
        0.02,
        {
          ...config,
          trustedScoringSignalsUrl: "https://trusted-server.test/scoring",
        },
        /* extraScript= */ ""
      )
    ).toEqual(10);
  });

  it("should run a scoring script without trusted scoring signals", async () => {
    expect(
      await runScoringScript(
        [
          "function scoreAd(",
          "  _adMetadata,",
          "  _bid,",
          "  { trustedScoringSignalsUrl },",
          ") {",
          "  if (trustedScoringSignalsUrl !== undefined) {",
          "    throw new Error();",
          "  }",
          "  return 10;",
          "}",
        ].join("\n"),
        '{"arbitraryKey":"arbitrary value"}',
        0.02,
        config,
        /* extraScript= */ ""
      )
    ).toEqual(10);
  });

  it("should ignore monkeypatching of built-in properties", async () => {
    expect(
      await runScoringScript(
        [
          "for (const { obj, property } of [",
          "  { obj: WorkerGlobalScope.prototype, property: 'self' },",
          "  { obj: globalThis, property: 'postMessage' },",
          "  { obj: console, property: 'warn' },",
          "]) {",
          "  Object.defineProperty(obj, property, {",
          "    get() {",
          "      throw new Error();",
          "    },",
          "  });",
          "}",
          "function scoreAd() {",
          "  return 10;",
          "}",
        ].join("\n"),
        /* adMetadataJson= */ "null",
        0.02,
        config,
        /* extraScript= */ ""
      )
    ).toEqual(10);
  });

  for (const { condition, scoringScript, warningData } of [
    {
      condition: "scoreAd is the wrong type",
      scoringScript: "scoreAd = true;",
      warningData: "true",
    },
    {
      condition: "scoreAd returns the wrong type",
      scoringScript: [
        "function scoreAd() {",
        "  return ['nope', null];",
        "}",
      ].join("\n"),
      warningData: "nope,",
    },
    {
      condition: "top-level script throws",
      scoringScript: "throw new Error('Oops');",
      warningData: "Error: Oops",
    },
    {
      condition: "scoreAd throws",
      scoringScript: [
        "function scoreAd() {",
        "  throw new Error('Oops');",
        "}",
      ].join("\n"),
      warningData: "Error: Oops",
    },
    {
      condition: "scoreAd property access throws",
      scoringScript: [
        "Object.defineProperty(globalThis, 'scoreAd', {",
        "  get() {",
        "    throw new Error('Oops');",
        "  }",
        "});",
      ].join("\n"),
      warningData: "Error: Oops",
    },
    {
      condition: "script tries to postMessage",
      scoringScript: [
        "postMessage([null]);",
        "function scoreAd() {",
        "  return 10;",
        "}",
      ].join("\n"),
      warningData: jasmine.stringMatching(/^ReferenceError: .*/),
    },
  ]) {
    it(`should log a warning and drop the bid if ${condition}`, async () => {
      const warningPromise = new Promise((resolve) => {
        setFakeServerHandler(({ body }) => {
          resolve(JSON.parse(new TextDecoder().decode(body)));
          return Promise.resolve({});
        });
      });
      expect(
        await runScoringScript(
          scoringScript,
          /* adMetadataJson= */ "null",
          0.02,
          config,
          [
            "console.warn = (...args) => {",
            "  void fetch('https://warning.test', {",
            "    method: 'POST',",
            "    body: JSON.stringify(args.map(String)),",
            "    keepalive: true,",
            "  });",
            "};",
          ].join("\n")
        )
      ).toBeNull();
      expect(await warningPromise).toEqual([jasmine.any(String), warningData]);
    });
  }
});
