/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview The entry point for the library. All public APIs are exported
 * from here.
 */

/**
 * Creates a new registration in this browser for a specified interest group and
 * stores it client-side.
 *
 * @see https://github.com/WICG/turtledove/blob/main/FLEDGE.md#11-joining-interest-groups
 */
export function joinAdInterestGroup(): void {
  throw new Error("Not yet implemented");
}

/**
 * Deletes an existing registration in this browser for a specified interest
 * group.
 *
 * @see https://github.com/WICG/turtledove/blob/main/FLEDGE.md#11-joining-interest-groups
 */
export function leaveAdInterestGroup(): void {
  throw new Error("Not yet implemented");
}

/**
 * Runs an on-device auction and asynchronously returns a URN that can be used
 * to render the winning ad, or null if there is no winning ad.
 *
 * @see https://github.com/WICG/turtledove/blob/main/FLEDGE.md#21-initiating-an-on-device-auction
 */
export function runAdAuction(): Promise<string | null> {
  throw new Error("Not yet implemented");
}
