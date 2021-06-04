/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { setFakeServerHandler } from "../testing/http";
import { runBiddingScript } from "./worklet";

describe("bid", () => {
  const group = {
    name: "interest group name",
    biddingLogicUrl: "https://dsp.test/bidder.js",
    trustedBiddingSignalsUrl: "https://trusted-server.test/bidding",
    ads: [
      { renderUrl: "about:blank#1", metadata: { price: 0.01 } },
      { renderUrl: "about:blank#2", metadata: { price: 0.02 } },
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
          "      ads[0].metadata.price === 0.01 &&",
          "      ads[1].renderUrl === 'about:blank#2' &&",
          "      ads[1].metadata.price === 0.02 &&",
          "      origin === 'null'",
          "    )",
          "  ) {",
          "    throw new Error();",
          "  }",
          "  return { bid: 0.03, render: 'about:blank#2' };",
          "}",
        ].join("\n"),
        group,
        /* extraScript= */ ""
      )
    ).toEqual({ bid: 0.03, render: "about:blank#2" });
  });

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
          "  return { bid: 0.03, render: 'about:blank#2' };",
          "}",
        ].join("\n"),
        group,
        /* extraScript= */ ""
      )
    ).toEqual({ bid: 0.03, render: "about:blank#2" });
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
      condition: "bid is the wrong type",
      biddingScript: [
        "function generateBid() {",
        "  return { bid: 'nope', render: 'about:blank#2' };",
        "}",
      ].join("\n"),
      warningData: "[object Object]",
    },
    {
      condition: "render is the wrong type",
      biddingScript: [
        "function generateBid() {",
        "  return { bid: 0.03, render: 42 };",
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
      condition: "bid property access throws",
      biddingScript: [
        "function generateBid() {",
        "  return {",
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
        "  return { bid: 0.03, render: 'about:blank#2' };",
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
