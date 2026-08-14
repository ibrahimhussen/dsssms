import type { RoleName } from '../types/auth';

/** Returns the default landing path for each role after login. */
export function getRoleDashboardPath(_role: RoleName): string {
  // All roles share the single '/' route. DashboardPage renders
  // the correct role-specific dashboard component internally.
  return '/';
}

/**
 * Resolves the post-login redirect destination.
 *
 * Honoring `from` is safe only when the user was trying to reach a page
 * they are actually allowed to see. We deliberately ignore `from` when
 * it points to '/unauthorized' or '/login' to prevent redirect loops.
 */
export function getPostLoginRedirect(
  role: RoleName,
  from?: string | null
): string {
  const blocked = new Set(['/unauthorized', '/login', '/']);

  if (from && !blocked.has(from)) {
    return from;
  }

  return getRoleDashboardPath(role);
}
