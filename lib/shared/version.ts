/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Versioning information to ensure that the library loads a frame
 * that's speaking the same version of the messaging protocol as itself.
 */

/**
 * The current version of FLEDGE Shim. It's a good idea to include this in the
 * URL where the frame is hosted, and template it into `frameSrc`, so that when
 * the library is upgraded the frame remains in sync.
 */
export const VERSION = "dev";

/**
 * The name of the object property whose value is {@link VERSION} in the initial
 * handshake message.
 */
export const VERSION_KEY = "fledgeShimVersion";
