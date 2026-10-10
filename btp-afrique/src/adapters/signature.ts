/**
 * Adaptateur de signature Ed25519 (Node). ⚠ CLÉ DE TEST UNIQUEMENT : la graine est publique dans le dépôt et ne protège rien.
 * Elle sert à prouver le mécanisme (ADR-0020) ; les vraies clés de publication ne seront jamais dans le dépôt.
 */
import { createPrivateKey, createPublicKey, sign, verify, type KeyObject } from 'node:crypto';
import type { SignatureVerifier } from '../core/pack/validate.js';

export const TEST_KEY_ID = 'test-key-1';
const TEST_SEED = Buffer.from('TEST-ONLY-KEY-NOT-A-SECRET-00000', 'utf8'); // 32 octets
const PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');

export function testPrivateKey(): KeyObject { return createPrivateKey({ key: Buffer.concat([PKCS8_PREFIX, TEST_SEED]), format: 'der', type: 'pkcs8' }); }
export function testPublicKey(): KeyObject { return createPublicKey(testPrivateKey()); }

export function signHash(contentHash: string): string {
  return sign(null, Buffer.from(contentHash, 'utf8'), testPrivateKey()).toString('base64');
}

export class Ed25519Verifier implements SignatureVerifier {
  constructor(private readonly keys: Record<string, KeyObject> = { [TEST_KEY_ID]: testPublicKey() }) {}
  verify(contentHash: string, sig: { keyId: string; alg: string; value: string }): boolean {
    const key = this.keys[sig.keyId];
    if (!key || sig.alg !== 'ed25519') return false;
    try { return verify(null, Buffer.from(contentHash, 'utf8'), key, Buffer.from(sig.value, 'base64')); } catch { return false; }
  }
}
