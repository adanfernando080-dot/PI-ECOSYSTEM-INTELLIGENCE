import { AppError, type Role } from '@pi/shared';

/**
 * RBAC policies — pure functions, the single source of truth for permissions.
 * Routes declare the role they require; services call these for
 * resource-level checks (ownership).
 */

export interface AuthUser {
  id: string;
  piUsername: string;
  role: Role;
  /** Developer profile linked to this user, if any. */
  developerId: string | null;
}

const ROLE_RANK: Record<Role, number> = { USER: 1, DEVELOPER: 2, ADMIN: 3 };

/** Roles are hierarchical: ADMIN ⊃ DEVELOPER ⊃ USER. */
export function hasRole(user: AuthUser | null | undefined, required: Role): boolean {
  return !!user && ROLE_RANK[user.role] >= ROLE_RANK[required];
}

export function assertRole(user: AuthUser | null | undefined, required: Role): asserts user is AuthUser {
  if (!user) throw AppError.unauthenticated();
  if (!hasRole(user, required)) throw AppError.forbidden(`This action requires the ${required} role`);
}

/** A developer may only modify apps linked to their own developer profile. Admins may modify any app. */
export function canManageApp(user: AuthUser, app: { developerId: string | null }): boolean {
  if (user.role === 'ADMIN') return true;
  return user.role === 'DEVELOPER' && user.developerId !== null && app.developerId === user.developerId;
}

export function assertCanManageApp(user: AuthUser, app: { developerId: string | null }): void {
  if (!canManageApp(user, app)) throw AppError.forbidden('You can only manage your own applications');
}

/** Developers cannot review their own app (conflict of interest). */
export function canReviewApp(user: AuthUser, app: { developerId: string | null }): boolean {
  return !(user.developerId !== null && app.developerId === user.developerId);
}
