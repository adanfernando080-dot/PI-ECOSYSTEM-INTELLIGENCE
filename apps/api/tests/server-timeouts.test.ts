import { createServer } from 'node:http';
import { describe, expect, it } from 'vitest';
import { HEADERS_TIMEOUT_MS, KEEP_ALIVE_TIMEOUT_MS, configureServerTimeouts } from '../src/http/server-timeouts';

describe('server timeouts', () => {
  it('outlive a typical 60 s load-balancer idle timeout, headersTimeout above keep-alive', () => {
    const server = configureServerTimeouts(createServer());
    expect(server.keepAliveTimeout).toBe(65_000);
    expect(server.headersTimeout).toBe(66_000);
    expect(KEEP_ALIVE_TIMEOUT_MS).toBeGreaterThan(60_000);
    expect(HEADERS_TIMEOUT_MS).toBeGreaterThan(KEEP_ALIVE_TIMEOUT_MS);
    server.close();
  });
});
