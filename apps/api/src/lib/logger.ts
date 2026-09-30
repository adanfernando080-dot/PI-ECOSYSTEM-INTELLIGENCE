import pino from 'pino';

/**
 * Structured JSON logger. Authorization headers, cookies and any field named
 * like a secret are redacted so tokens and keys never end up in logs.
 */
export function createLogger(level: string) {
  return pino({
    level,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'headers.authorization',
        '*.password',
        '*.token',
        '*.apiKey',
        '*.secret',
        'PI_API_KEY',
        'JWT_SECRET',
      ],
      censor: '[REDACTED]',
    },
  });
}
