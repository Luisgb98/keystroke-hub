# Database

Keystroke Hub uses [Neon](https://neon.tech) Postgres via
[Drizzle ORM](https://orm.drizzle.team) and drizzle-kit, deployed on
[Vercel](https://vercel.com). This is the foundation only — it establishes
the connection and migration workflow so feature issues never have to
re-litigate it. No feature tables live here.

## Connection strings

Neon exposes two connection strings, both required:

| Env var                 | Used by                                                | Why                                                                        |
| ----------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------- |
| `DATABASE_URL`          | The app at runtime (`lib/db`)                          | Pooled (PgBouncer) — safe for serverless functions issuing short queries.  |
| `DATABASE_URL_UNPOOLED` | `drizzle-kit` (`db:generate`/`db:migrate`/`db:studio`) | Direct — migrations need session-level features PgBouncer doesn't support. |

On Vercel, both are injected automatically by the Neon ↔ Vercel integration.
Locally, copy `.env.example` to `.env.local` and fill them in from the Neon
console, using a Neon **development branch** (not production) — this gives
full parity with prod without needing a local Postgres/Docker setup.

The app reads `DATABASE_URL` through `lib/db/index.ts`, a lazily-initialized
singleton guarded by the `server-only` package — it will fail a build if ever
imported into client-bundle code, and the var itself is never
`NEXT_PUBLIC_`-prefixed.

## Migration workflow

1. Edit `lib/db/schema.ts` (adding/changing `pgTable` definitions).
2. `pnpm db:generate` — drizzle-kit diffs the schema and emits a plain-SQL
   migration file into `lib/db/migrations/`.
3. `pnpm db:migrate` — applies any pending migrations to the DB targeted by
   your env (uses `DATABASE_URL_UNPOOLED`).
4. Commit the generated migration file(s) alongside the feature PR that
   needs them.
5. Migrations are applied to production manually (`pnpm db:migrate` with
   production env) before/at merge — there is no CI automation for this yet
   (see below).

`pnpm db:studio` opens Drizzle Studio against `DATABASE_URL_UNPOOLED` for
browsing/editing data directly.

The only table created without an explicit migration is drizzle-kit's own
bookkeeping table, `__drizzle_migrations`, on first `db:migrate` run.

## Verifying the connection

`GET /api/health` runs `SELECT 1` through the same db client the app uses,
and returns `{ "status": "ok" }` (200) or `{ "status": "error", "message" }`
(503). Use this to confirm the connection works locally, on a Vercel
preview, or in production, without needing feature tables to exist yet.

## Known gaps (deferred, tracked for follow-up)

- **No DB credentials in CI**: the CI `e2e` job (see `.github/workflows/ci.yml`)
  has no `DATABASE_URL` secret, so the health e2e spec skips there and only
  exercises the real connection locally and on Vercel previews. Giving CI
  real coverage needs a secret — ideally an ephemeral Neon branch per run —
  proposed as a small follow-up chore.
- **No production migration automation**: applying migrations to production
  is a manual step for now. Automating it in CI on merge to `main` would
  need production credentials as a secret; deferred.

## Neon cold starts

Neon's free tier suspends idle compute. The first query after idle can take
a few seconds while it wakes up — this is expected, not a bug. The health
e2e spec's timeout accounts for it.
