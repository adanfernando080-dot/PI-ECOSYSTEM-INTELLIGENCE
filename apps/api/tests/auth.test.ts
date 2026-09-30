import { describe, expect, it } from 'vitest';
import { signToken, verifyToken } from '../src/auth/jwt';
import { assertCanManageApp, canManageApp, canReviewApp, hasRole, type AuthUser } from '../src/auth/policies';

const SECRET = 'x'.repeat(40);
const ISS = 'pi-ecosystem-intelligence';

describe('jwt (HS256)', () => {
  it('round-trips a valid token', () => {
    const t = signToken('user-1', SECRET, ISS, 60);
    const r = verifyToken(t, SECRET, ISS);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.claims.sub).toBe('user-1');
  });

  it('rejects a wrong secret, a wrong issuer and an expired token', () => {
    const t = signToken('u', SECRET, ISS, 60);
    expect(verifyToken(t, 'y'.repeat(40), ISS)).toEqual({ ok: false, reason: 'bad_signature' });
    expect(verifyToken(t, SECRET, 'other')).toEqual({ ok: false, reason: 'bad_issuer' });
    const old = signToken('u', SECRET, ISS, 60, Date.now() - 3_600_000);
    expect(verifyToken(old, SECRET, ISS)).toEqual({ ok: false, reason: 'expired' });
  });

  it('rejects alg=none and tampered payloads', () => {
    const [, payload] = signToken('u', SECRET, ISS).split('.');
    const none = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${payload}.`;
    expect(verifyToken(none, SECRET, ISS)).toEqual({ ok: false, reason: 'unsupported_algorithm' });

    const [h, , s] = signToken('u', SECRET, ISS).split('.');
    const forged = Buffer.from(JSON.stringify({ sub: 'admin', iss: ISS, iat: 1, exp: 9e9 })).toString('base64url');
    expect(verifyToken(`${h}.${forged}.${s}`, SECRET, ISS)).toEqual({ ok: false, reason: 'bad_signature' });
    expect(verifyToken('garbage', SECRET, ISS)).toEqual({ ok: false, reason: 'malformed' });
  });
});

describe('RBAC policies', () => {
  const user: AuthUser = { id: 'u', piUsername: 'u', role: 'USER', developerId: null };
  const dev: AuthUser = { id: 'd', piUsername: 'd', role: 'DEVELOPER', developerId: 'dev-1' };
  const admin: AuthUser = { id: 'a', piUsername: 'a', role: 'ADMIN', developerId: null };

  it('is hierarchical', () => {
    expect(hasRole(user, 'USER')).toBe(true);
    expect(hasRole(user, 'DEVELOPER')).toBe(false);
    expect(hasRole(dev, 'USER')).toBe(true);
    expect(hasRole(dev, 'ADMIN')).toBe(false);
    expect(hasRole(admin, 'DEVELOPER')).toBe(true);
    expect(hasRole(null, 'USER')).toBe(false);
  });

  it('lets developers manage only their own apps', () => {
    expect(canManageApp(dev, { developerId: 'dev-1' })).toBe(true);
    expect(canManageApp(dev, { developerId: 'dev-2' })).toBe(false);
    expect(canManageApp(dev, { developerId: null })).toBe(false);
    expect(canManageApp(user, { developerId: null })).toBe(false);
    expect(canManageApp(admin, { developerId: 'dev-2' })).toBe(true);
    expect(() => assertCanManageApp(dev, { developerId: 'dev-2' })).toThrow('own applications');
  });

  it('prevents developers from reviewing their own app', () => {
    expect(canReviewApp(dev, { developerId: 'dev-1' })).toBe(false);
    expect(canReviewApp(dev, { developerId: 'dev-2' })).toBe(true);
    expect(canReviewApp(user, { developerId: null })).toBe(true);
  });
});
