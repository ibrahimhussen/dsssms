# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| latest  | ✅        |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Please report security issues privately:

1. Email: [security contact — add your email here]
2. Include: description, steps to reproduce, potential impact, and (if known) a suggested fix.
3. You will receive an acknowledgement within 48 hours.
4. We aim to release a patch within 14 days of confirmation.

## Security Measures

- **Authentication**: JWT access tokens (15 min) + httpOnly cookie refresh tokens (7 days)
- **Account lockout**: 5 failed attempts → 15-minute lockout
- **Password policy**: minimum 8 chars, upper, lower, digit, special character
- **HTTPS**: enforced in production via `FORCE_HTTPS=true` + HSTS
- **Input sanitization**: HTML/script tags stripped from all POST/PUT/PATCH bodies
- **CORS**: restricted to configured origin
- **Rate limiting**: 300 req/15 min general; stricter on login endpoint
- **Audit log**: all auth events, sensitive data changes, and admin actions recorded

## Out of Scope

- Vulnerabilities requiring physical access to the server
- Social engineering attacks
- Issues in third-party dependencies (report those upstream)
