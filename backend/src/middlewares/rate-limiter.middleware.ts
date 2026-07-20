import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import { ApiResponse } from '../core/http/api-response';

/**
 * General-purpose limiter applied to the whole API — protects against
 * abusive traffic and casual denial-of-service attempts.
 */
export const generalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
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
 * Strict limiter on the login endpoint specifically. This is a
 * network-level throttle that complements (not replaces) the
 * per-account lockout enforced in AuthService.
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (_req, res) => {
    ApiResponse.error(res, {
      statusCode: 429,
      message: 'Too many login attempts from this network, please try again later',
      errorCode: 'TOO_MANY_REQUESTS',
    });
  },
});
