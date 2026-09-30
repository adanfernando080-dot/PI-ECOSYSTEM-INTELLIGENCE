import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Minimal HS256 JSON Web Token implementation (node:crypto only).
 *
 * V1 authentication: a trusted server issues short-lived tokens; the API
 * verifies them. When Pi authentication is wired (integrations/pi →
 * PiAuthProvider), a login endpoint will exchange a verified Pi identity for
 * one of these tokens. Roles are NOT trusted from the token: they are read
 * from the database on every request (see middleware/auth.ts).
 */

export interface TokenClaims {
  sub: string;
  iss: string;
  iat: number;
  exp: number;
}

const b64url = (buf: Buffer | string) => Buffer.from(buf).toString('base64url');

export function signToken(sub: string, secret: string, issuer: string, ttlSeconds = 3600, now = Date.now()): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const iat = Math.floor(now / 1000);
  const payload = b64url(JSON.stringify({ sub, iss: issuer, iat, exp: iat + ttlSeconds }));
  const signature = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

export type VerifyResult = { ok: true; claims: TokenClaims } | { ok: false; reason: string };

export function verifyToken(token: string, secret: string, issuer: string, now = Date.now()): VerifyResult {
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'malformed' };
  const [header, payload, signature] = parts as [string, string, string];

  let parsedHeader: { alg?: string; typ?: string };
  let claims: Partial<TokenClaims>;
  try {
    parsedHeader = JSON.parse(Buffer.from(header, 'base64url').toString('utf8'));
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  // Only HS256 is accepted — rejects "none" and algorithm-confusion attacks.
  if (parsedHeader.alg !== 'HS256') return { ok: false, reason: 'unsupported_algorithm' };

  const expected = createHmac('sha256', secret).update(`${header}.${payload}`).digest();
  const given = Buffer.from(signature, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { ok: false, reason: 'bad_signature' };
  }
  if (typeof claims.sub !== 'string' || typeof claims.exp !== 'number' || typeof claims.iat !== 'number') {
    return { ok: false, reason: 'invalid_claims' };
  }
  if (claims.iss !== issuer) return { ok: false, reason: 'bad_issuer' };
  if (claims.exp * 1000 <= now) return { ok: false, reason: 'expired' };
  return { ok: true, claims: claims as TokenClaims };
}
