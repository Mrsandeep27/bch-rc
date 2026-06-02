/**
 * Order ID generator: "<SITE_PREFIX>-XXXXXXXX" using nanoid.
 *
 * Alphabet excludes ambiguous chars (0/O/1/I) to make IDs readable
 * when typed off a WhatsApp confirmation.
 */

import { customAlphabet } from "nanoid";

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // 32 chars, no 0/O/1/I
const generator = customAlphabet(ALPHABET, 8);

export function generateOrderId(prefix: string): string {
  return `${prefix.toUpperCase()}-${generator()}`;
}

/** Validate the shape so /track can reject typos early. */
export function isValidOrderId(id: string): boolean {
  return /^[A-Z]{2,6}-[A-Z0-9]{8}$/.test(id);
}
