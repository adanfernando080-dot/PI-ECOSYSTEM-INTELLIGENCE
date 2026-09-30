import type { NextFunction, Request, Response } from 'express';
import { AppError } from '@pi/shared';
import { verifyToken } from '../auth/jwt';
import type { UserRepository } from '../domain/ports';

/**
 * Optional authentication: when a Bearer token is present it must be valid;
 * the user (and their role) is then loaded from the DATABASE, so a role can
 * never be escalated by crafting a token. Anonymous requests continue with
 * res.locals.user = null; routes enforce roles themselves.
 */
export function authenticate(users: UserRepository, secret: string, issuer: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    res.locals.user = null;
    const header = req.headers.authorization;
    if (!header) return next();

    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) return next(AppError.unauthenticated('Malformed Authorization header'));

    const verified = verifyToken(token, secret, issuer);
    if (!verified.ok) return next(AppError.unauthenticated(`Invalid token (${verified.reason})`));

    try {
      const user = await users.findAuthUser(verified.claims.sub);
      if (!user) return next(AppError.unauthenticated('Unknown user'));
      res.locals.user = { id: user.id, piUsername: user.piUsername, role: user.role, developerId: user.developerId };
      next();
    } catch (err) {
      next(err);
    }
  };
}
