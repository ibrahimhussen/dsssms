import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import { ApiResponse } from '../core/http/api-response';

/**
 * General-purpose limiter applied to the whole API — protects against
 * abusive traffic and casual denial-of-service attempts.
 *
 * The default (1 000 req / 15 min) is sized for a school where many users
 * share one NAT IP address. Tune RATE_LIMIT_MAX_REQUESTS in .env for
 * smaller or larger deployments.
 */
export const generalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,   // Return RateLimit-* headers so clients know their budget
  legacyHeaders: false,
  handler: (_req, res) => {
    ApiResponse.error(res, {
      statusCode: 429,
      message: 'Too many requests, please try again later',
      errorCode: 'TOO_MANY_REQUESTS',
    });
  },
});

/**
 * Strict limiter on the login endpoint — network-level throttle that
 * complements (does not replace) the per-account lockout in AuthService.
 *
 * Design choices:
 *  • skipSuccessfulRequests: true — only failed attempts count against the
 *    quota.  A classroom of 30 students logging in at the same time will not
 *    consume any quota and will never see this error.
 *  • Default: 50 failed attempts per 15-minute window per IP.  That is far
 *    more than any legitimate user needs while still throttling automated
 *    attacks.  Tune LOGIN_RATE_LIMIT_MAX_ATTEMPTS in .env if necessary.
 *  • standardHeaders: true — includes RateLimit-* and Retry-After headers
 *    so the frontend can tell the user exactly how long to wait.
 */
export const loginRateLimiter = rateLimit({
  windowMs: env.LOGIN_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
  max: env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (_req, res) => {
    ApiResponse.error(res, {
      statusCode: 429,
      message: `Too many failed login attempts from this network. Please wait ${env.LOGIN_RATE_LIMIT_WINDOW_MINUTES} minutes before trying again.`,
      errorCode: 'TOO_MANY_REQUESTS',
    });
  },
});
