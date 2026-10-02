/**
 * Address handling, in one place so the rule can be tightened later (e.g. once
 * the official address format of the target network is confirmed from its
 * documentation) without touching importers.
 *
 * Deliberately generic: an address is a bare alphanumeric token. This module
 * does NOT claim an address is valid on any network, nor that it exists, nor
 * that it belongs to an application — that is what `verification` is for.
 */
export const ADDRESS_MIN_LENGTH = 20;
export const ADDRESS_MAX_LENGTH = 128;

/** Trim only: case is significant for most address encodings and is never altered. */
export function normalizeAddress(input: string): string {
  return input.trim();
}

/** Returns why the (normalized) address is unacceptable, or null when it is fine. */
export function addressProblem(address: string): string | null {
  if (address.length < ADDRESS_MIN_LENGTH || address.length > ADDRESS_MAX_LENGTH) {
    return `must be ${ADDRESS_MIN_LENGTH}-${ADDRESS_MAX_LENGTH} characters long`;
  }
  if (!/^[A-Za-z0-9]+$/.test(address)) return 'must contain only letters and digits (no spaces or symbols)';
  return null;
}
