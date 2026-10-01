import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/config/env';

const base = {
  DATABASE_URL: 'postgresql://user:pass@db.example.com:5432/app',
  JWT_SECRET: 'j'.repeat(40),
};
const prod = (extra: Record<string, string | undefined> = {}) => ({ ...base, NODE_ENV: 'production', ...extra });

describe('CORS_ORIGINS configuration', () => {
  it('keeps the convenient local default in development and test', () => {
    expect(loadEnv({ ...base }).CORS_ORIGINS).toEqual(['http://localhost:5173']);
    expect(loadEnv({ ...base, NODE_ENV: 'test' }).CORS_ORIGINS).toEqual(['http://localhost:5173']);
    expect(loadEnv({ ...base, CORS_ORIGINS: 'http://localhost:3001, https://a.example.com' }).CORS_ORIGINS).toEqual([
      'http://localhost:3001',
      'https://a.example.com',
    ]);
  });

  it('is required in production (missing or blank)', () => {
    expect(() => loadEnv(prod())).toThrow(/CORS_ORIGINS is required in production/);
    expect(() => loadEnv(prod({ CORS_ORIGINS: '' }))).toThrow(/CORS_ORIGINS is required in production/);
    expect(() => loadEnv(prod({ CORS_ORIGINS: ' , ' }))).toThrow(/CORS_ORIGINS is required in production/);
  });

  it('accepts one or several https origins in production', () => {
    expect(loadEnv(prod({ CORS_ORIGINS: 'https://frontend.example.com' })).CORS_ORIGINS).toEqual(['https://frontend.example.com']);
    expect(loadEnv(prod({ CORS_ORIGINS: 'https://a.example.com, https://b.example.com:8443' })).CORS_ORIGINS).toEqual([
      'https://a.example.com',
      'https://b.example.com:8443',
    ]);
  });

  it('rejects the wildcard in production, even mixed with valid origins', () => {
    expect(() => loadEnv(prod({ CORS_ORIGINS: '*' }))).toThrow(/wildcard/);
    expect(() => loadEnv(prod({ CORS_ORIGINS: 'https://a.example.com,*' }))).toThrow(/wildcard/);
  });

  it('rejects non-https, local, malformed and non-bare origins in production', () => {
    expect(() => loadEnv(prod({ CORS_ORIGINS: 'http://frontend.example.com' }))).toThrow(/must use https/);
    expect(() => loadEnv(prod({ CORS_ORIGINS: 'https://localhost:5173' }))).toThrow(/local host/);
    expect(() => loadEnv(prod({ CORS_ORIGINS: 'https://127.0.0.1' }))).toThrow(/local host/);
    expect(() => loadEnv(prod({ CORS_ORIGINS: 'frontend.example.com' }))).toThrow(/not a valid origin/);
    expect(() => loadEnv(prod({ CORS_ORIGINS: 'https://frontend.example.com/' }))).toThrow(/bare origin/);
    expect(() => loadEnv(prod({ CORS_ORIGINS: 'https://frontend.example.com/app' }))).toThrow(/bare origin/);
  });

  it('does not change the other settings', () => {
    const env = loadEnv(prod({ CORS_ORIGINS: 'https://frontend.example.com', PORT: '8080' }));
    expect(env).toMatchObject({ NODE_ENV: 'production', PORT: 8080, JWT_ISSUER: 'pi-ecosystem-intelligence' });
    expect(() => loadEnv({ ...base, JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
  });
});
