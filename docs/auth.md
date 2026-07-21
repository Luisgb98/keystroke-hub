# Authentication

Keystroke Hub is a single-user app on a public URL, so everything sits behind
a lightweight access gate (issue #8): one password, a signed session cookie,
no accounts, no user table, no auth library.

## Setup

Two env vars (both in `.env.example`, set them in `.env` locally and in the
Vercel project settings for deploys):

1. **`SESSION_SECRET`** — signs the session cookie. Generate one:

   ```bash
   openssl rand -base64 32
   ```

2. **`AUTH_PASSWORD_HASH`** — scrypt hash of your login password. Generate it
   (interactive prompt, plaintext never stored):

   ```bash
   pnpm auth:hash
   ```

## How the gate works

- **Credential** — a single password, no username. It's verified server-side
  in a Server Action (`lib/auth/actions.ts`) against `AUTH_PASSWORD_HASH`
  using `node:crypto` scrypt + `timingSafeEqual` (`lib/auth/password.ts`).
  Failed attempts get a generic error after a ~1 s delay to blunt brute force.
  The hash is encoded as `scrypt.N.r.p.salt.key` — deliberately `.`-delimited
  rather than the more conventional `$` (as bcrypt/PHC-style hashes use):
  Next.js's env loader runs `dotenv-expand` on `.env` values, which treats an
  unescaped `$` as a `$VAR`/`${VAR}` reference and silently replaces it with
  an empty string when unmatched — corrupting any `$`-delimited hash on every
  load, with no error. `.` never appears in base64 output, so it needs no
  escaping.
- **Session** — a stateless JWT (HS256 via [jose](https://github.com/panva/jose)),
  stored in an `HttpOnly` / `Secure` (production) / `SameSite=Lax` cookie.
  **30-day rolling expiry**: activity re-issues the token (at most once a
  day, never on prefetches, so a stray in-flight response can't resurrect a
  signed-out session), meaning an actively used device never logs out while
  an abandoned one expires. No database is involved.
- **Route protection, two layers** (the pattern from Next.js's own auth
  guide):
  1. `proxy.ts` — optimistic check on every request: no valid cookie →
     redirect to `/login` (with a `from` param so deep links are restored
     after signing in); already signed in and visiting `/login` → redirect
     home. Unauthenticated `/api/*` requests get a `401` instead of a
     redirect. Exemptions: `/api/health` (public uptime probe, leaks
     nothing), Next internals, and static files.
  2. `verifySession()` in `lib/auth/session.ts` — the authoritative
     data-access-layer check, called by protected layouts/pages and any
     future Server Action or route handler that touches data. Proxy checks
     alone are advisory by design.
- **Sign-out** — a Server Action that deletes the cookie; the button lives in
  the sidebar footer (desktop) and the bottom bar (mobile).

## Operational notes

- **Rotate the password**: re-run `pnpm auth:hash`, update
  `AUTH_PASSWORD_HASH` on Vercel, redeploy. Existing sessions survive —
  they're tied to `SESSION_SECRET`, not the password.
- **Global logout (break glass)**: rotate `SESSION_SECRET`. Every session
  everywhere becomes invalid immediately.
- **Sign-out scope**: signing out clears _this device's_ cookie. Other
  devices stay signed in until their 30-day window lapses (stateless
  sessions have no remote revocation) — rotate `SESSION_SECRET` if you need
  that.
- **Rate limiting**: there is none beyond the constant-time compare and the
  1 s failure delay — proportionate for a single-user app. If the URL ever
  attracts attention, add Vercel WAF / rate rules in front.
- **`AUTH_FAILURE_DELAY_MS`** (optional): overrides the failure delay in
  milliseconds, mainly so unit/e2e tests don't wait out the real 1 s. Leave
  unset in production.

## Testing

- Unit tests cover password hashing/verification, session
  encrypt/decrypt/expiry, the login/logout actions, and the proxy gate.
- E2e tests (`e2e/auth.spec.ts`) cover the full flow — redirect to login,
  wrong password, deep-link restore, session persistence, sign-out. The
  Playwright config injects dedicated test credentials into the app under
  test (`e2e/support/credentials.ts`); other e2e specs authenticate once via
  a setup project and reuse the storage state from `e2e/.auth/`.
