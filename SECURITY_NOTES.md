## Security Notes

### Current status

This project went through a focused security hardening pass on March 27-28, 2026.

Confirmed protections currently in place:

- Mercado Pago webhook signature validation is active in production.
- Supabase RLS is active for sensitive tables tested from the public client side.
- Authentication-related rate limiting is active in production.
- New email verification tokens are stored hashed with SHA-256.
- Verification email HTML escapes user-controlled values before rendering.

### Security changes applied

#### 1. Mercado Pago webhook validation

The backend validates the Mercado Pago webhook signature before processing payment notifications.

Relevant env vars:

- `MP_WEBHOOK_SECRET`
- `MERCADO_PAGO_WEBHOOK_SECRET`

Operational note:

- If the webhook secret is missing, the backend can fall back to an unsafe mode locally.
- Production should always have the secret configured.

#### 2. Supabase-backed rate limiting

The backend now uses Supabase/Postgres as the primary storage for rate limiting via the `consume_rate_limit` RPC.

Primary SQL files:

- [supabase/create_rate_limits.sql](/d:/ARCHIVOS%20JUAN/Escritorio/Nueva%20carpeta/supabase/create_rate_limits.sql)
- [supabase/fix_consume_rate_limit_signature.sql](/d:/ARCHIVOS%20JUAN/Escritorio/Nueva%20carpeta/supabase/fix_consume_rate_limit_signature.sql)

Storage behavior:

- Primary mode: Supabase RPC-backed counters
- Fallback mode: in-memory counters inside the backend process
- Recovery behavior: when Supabase fails temporarily, the backend retries Supabase automatically after a short interval instead of staying permanently in fallback mode

#### 3. Active rate-limited endpoints

- `POST /api/auth/login`
  Code: `AUTH_LOGIN_RATE_LIMITED`
  Message: `Too many login attempts, please try again later`
- `POST /api/auth/register`
  Code: `AUTH_REGISTER_RATE_LIMITED`
  Message: `Too many registration attempts, please try again later`
- `POST /api/register`
  Same behavior as `POST /api/auth/register`
- `POST /api/auth/verify-email/resend`
  Code: `AUTH_VERIFY_EMAIL_RESEND_RATE_LIMITED`
  Message: `Too many verification email requests, please try again later`
- `POST /api/payments/webhook`
  Code: `PAYMENTS_WEBHOOK_RATE_LIMITED`
  Message: `Too many payment webhook requests, please try again later`

The backend also sends `Retry-After` when a limit is exceeded.

#### 4. Current effective limits observed in production

The exact thresholds depend on the configured rules in `server/index.js`.

During production validation, the current behavior was:

- Login blocked starting on attempt 9
- Verification email resend blocked starting on attempt 6
- Registration blocked starting on attempt 4

These values reflect the effective behavior observed during validation and should be rechecked if rate-limit constants change.

#### 5. Email verification token hardening

New verification tokens are no longer stored in plaintext.

Current behavior:

- The raw token is generated server-side
- The SHA-256 hash is stored in `email_verification_tokens.token`
- The raw token is only sent to the user via the verification link

Compatibility rule:

- Verification accepts both hashed tokens and legacy plaintext tokens so previously issued links continue to work during the migration period

Operational implication:

- Old links remain valid until they expire
- New links are protected against straightforward token reuse if the table is read

#### 6. Verification email HTML escaping

The email template now HTML-escapes user-controlled values before inserting them into the email body.

Protected fields include:

- Username / display value in the greeting
- Expiration text
- Verification link rendering in the HTML body

This reduces the risk of markup injection inside transactional emails.

### Files changed during the hardening pass

Application logic:

- [server/index.js](/d:/ARCHIVOS%20JUAN/Escritorio/Nueva%20carpeta/server/index.js)

Supabase SQL:

- [supabase/create_rate_limits.sql](/d:/ARCHIVOS%20JUAN/Escritorio/Nueva%20carpeta/supabase/create_rate_limits.sql)
- [supabase/fix_consume_rate_limit_signature.sql](/d:/ARCHIVOS%20JUAN/Escritorio/Nueva%20carpeta/supabase/fix_consume_rate_limit_signature.sql)

Documentation:

- [SECURITY_NOTES.md](/d:/ARCHIVOS%20JUAN/Escritorio/Nueva%20carpeta/SECURITY_NOTES.md)

### Production verification performed

Production checks performed during the hardening pass:

- Invalid login attempts now return `429` with the correct auth-specific message after repeated attempts
- Verification email resend now returns `429` with the correct resend-specific message after repeated attempts
- Registration now returns `429` with the correct register-specific message after repeated attempts
- `Retry-After` is present on rate-limited responses
- `GET /health` continues returning `200`
- Invalid email verification tokens continue returning `404` without breaking the endpoint
- Mercado Pago webhook without signature continues returning `401`
- Supabase client-side anonymous writes to protected tables remain blocked by RLS

### Residual risks and operational notes

- The webhook secret must remain configured in production.
- The backend still includes an in-memory fallback for rate limiting to preserve availability if Supabase is temporarily unavailable.
- That fallback is intentionally a resilience measure, not the desired steady-state in production.
- Legacy plaintext verification tokens may still exist until previously issued links expire or are deleted.

### Recommended future follow-ups

- Remove legacy plaintext token compatibility after the migration window is safely over.
- Consider adding explicit monitoring/logging for whether rate limiting is operating in `supabase` or `memory` mode.
- Consider documenting backup and recovery procedures separately for:
  - Git repository state
  - Supabase database
  - Supabase storage
  - production environment variables
