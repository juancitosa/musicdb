## Security Notes

### Rate limiting

The backend enforces rate limits for:

- `POST /api/auth/login`
  Code: `AUTH_LOGIN_RATE_LIMITED`
  Message: `Too many login attempts, please try again later`
- `POST /api/auth/register`
  Code: `AUTH_REGISTER_RATE_LIMITED`
  Message: `Too many registration attempts, please try again later`
- `POST /api/auth/verify-email/resend`
  Code: `AUTH_VERIFY_EMAIL_RESEND_RATE_LIMITED`
  Message: `Too many verification email requests, please try again later`
- `POST /api/payments/webhook`
  Code: `PAYMENTS_WEBHOOK_RATE_LIMITED`
  Message: `Too many payment webhook requests, please try again later`

Storage strategy:

- Primary storage uses Supabase via the `consume_rate_limit` RPC.
- If Supabase is temporarily unavailable, the backend falls back to in-memory counters and retries Supabase automatically.

### Email verification tokens

- New verification tokens are stored hashed with SHA-256 before insertion into `email_verification_tokens`.
- Verification accepts both hashed and legacy plaintext tokens so previously issued links continue to work during the migration period.

### Email HTML safety

- User-controlled values interpolated into verification emails are HTML-escaped before rendering.
