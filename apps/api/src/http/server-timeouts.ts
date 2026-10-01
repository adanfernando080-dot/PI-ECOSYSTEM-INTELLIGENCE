import type { Server } from 'node:http';

/**
 * Behind a managed load balancer (typically ~60 s idle timeout) Node's default
 * keep-alive of 5 s closes sockets the proxy still considers open, which shows
 * up as sporadic 502s. The server must outlive the proxy's idle timeout, and
 * headersTimeout must stay above keepAliveTimeout.
 */
export const KEEP_ALIVE_TIMEOUT_MS = 65_000;
export const HEADERS_TIMEOUT_MS = 66_000;

export function configureServerTimeouts<T extends Server>(server: T): T {
  server.keepAliveTimeout = KEEP_ALIVE_TIMEOUT_MS;
  server.headersTimeout = HEADERS_TIMEOUT_MS;
  return server;
}
