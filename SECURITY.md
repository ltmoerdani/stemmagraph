# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| latest  | ✅                  |
| <latest | ❌                  |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **DO NOT** open a public GitHub issue
2. Email: **security [at] ltmoerdani [dot] com** (or use GitHub's private vulnerability reporting)
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

You will receive a response within **48 hours**. Please do not disclose the vulnerability publicly until it has been fixed.

## Security Measures

- **Passwords**: hashed with bcrypt (12 rounds)
- **Sessions**: JWT-based with 7-day expiry
- **API**: all routes protected by auth middleware (except login/register)
- **Input validation**: required on auth endpoints
- **Secrets**: `JWT_SECRET` must be set in production (server refuses to start otherwise)

## Production Deployment Checklist

Before deploying to production:

- [ ] Set `JWT_SECRET` to a strong random value (`openssl rand -hex 32`)
- [ ] Set `NODE_ENV=production`
- [ ] Set `DATABASE_URL` to a production database (PostgreSQL recommended)
- [ ] Enable HTTPS
- [ ] Configure CORS to only allow your frontend domain
- [ ] Set up rate limiting (not included by default)
