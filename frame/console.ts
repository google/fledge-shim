/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Utilities for logging information to the console in the frame,
 * for the benefit of developers trying to debug FLEDGE Shim or their
 * integrations with it.
 *
 * In general, these APIs are used whenever the frame encounters an I/O error
 * (including receiving invalid data) when communicating with something outside
 * its direct control, such as the parent page, IndexedDB, or a URL where data
 * is to be fetched from. Nothing is logged in the success path, and errors
 * caused by bugs in the FLEDGE Shim frame itself are thrown as exceptions.
 * (Integration bugs between the frame and the library can result in these kinds
 * of logs, though, because the two components cannot trust one another.) In
 * order to preserve confidentiality of FLEDGE Shim data, error messages from
 * the frame are not exposed to the library; developers are instead advised to
 * inspect the console logs.
 */

const prefix = "[FLEDGE Shim] ";

/**
 * Logs a console error. Used when an error occurs that makes it impossible to
 * continue with the current operation.
 */
export function logError(message: string, data?: readonly unknown[]): void {
  console.error(prefix + message, ...(data ?? []));
}

/**
 * Logs a console warning. Used when an error occurs that can be recovered from.
 */
export function logWarning(message: string, data?: readonly unknown[]): void {
  console.warn(prefix + message, ...(data ?? []));
}
