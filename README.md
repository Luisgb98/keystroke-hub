# Keystroke Hub

A single-user personal app for a full-stack developer who is also a gaming
content creator. It keeps two worlds side by side without mixing them:

- **Work life** — tasks, daily/weekly logs, meetings, projects.
- **Content creation** — video ideas, scripts, video/stream schedule.

Both tracks share one calendar UI but stay strictly separated everywhere else.

This is a personal project built for one user (me) — it isn't looking for
contributions, but the code is public so feel free to read, fork, or borrow
from it.

## Tech stack

- [Next.js](https://nextjs.org) (App Router) + React
- Tailwind CSS + [shadcn/ui](https://ui.shadcn.com)
- Postgres on [Neon](https://neon.tech), deployed on [Vercel](https://vercel.com)
- TypeScript

## Getting started

This project uses **pnpm only** — do not use npm or yarn.

```bash
pnpm install
```

Copy `.env.example` to `.env.local` and fill in the values:

- **`DATABASE_URL`** / **`DATABASE_URL_UNPOOLED`** — Neon Postgres connection
  strings (pooled and direct). Copy them from the Neon console for your
  development branch. See [`docs/database.md`](docs/database.md).
- **`SESSION_SECRET`** — generate with `openssl rand -base64 32`.
- **`AUTH_PASSWORD_HASH`** — generate with `pnpm auth:hash`. See
  [`docs/auth.md`](docs/auth.md).

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see the result.

## Code quality

| Script              | What it does                                |
| ------------------- | ------------------------------------------- |
| `pnpm lint`         | Lint the codebase with ESLint               |
| `pnpm lint:fix`     | Lint and auto-fix what it can               |
| `pnpm format`       | Format the codebase with Prettier           |
| `pnpm format:check` | Check formatting without writing changes    |
| `pnpm typecheck`    | Type-check the codebase with `tsc --noEmit` |
| `pnpm test`         | Run unit tests with Vitest                  |
| `pnpm test:e2e`     | Run end-to-end tests with Playwright        |
| `pnpm build`        | Build the production app                    |

ESLint (flat config, `eslint-config-next` + `eslint-config-prettier`) and
Prettier (with `prettier-plugin-tailwindcss` for deterministic Tailwind class
ordering) are configured to never disagree — ESLint defers all stylistic
concerns to Prettier. All of the above must pass before a PR is opened; see
`AGENTS.md` for the full workflow contract.

## Testing

Testing is mandatory for every feature — see `AGENTS.md`.

- **Unit tests** are colocated next to the code they test, as `*.test.ts` /
  `*.test.tsx` files (e.g. `lib/utils.test.ts`,
  `components/theme-toggle.test.tsx`). They run with
  [Vitest](https://vitest.dev) + [Testing Library](https://testing-library.com)
  in a jsdom environment. Prefer Testing Library's user-facing queries
  (`getByRole`, `getByText`, …) over implementation details.
  - `pnpm test` — run all unit tests once (CI-ready, headless).
  - `pnpm test:watch` — re-run on file changes while developing.
  - `pnpm test:coverage` — run with a v8 coverage report.
- **E2e tests** live in `e2e/` as `*.spec.ts` files and exercise real user
  flows with [Playwright](https://playwright.dev) against the actual
  production build (`pnpm build && pnpm start`), not the dev server. Every
  spec runs against both a desktop (`chromium`) and a mobile (`Pixel 7`)
  project to enforce the mobile-first contract.
  - One-time setup: `pnpm exec playwright install --with-deps chromium`.
  - `pnpm test:e2e` — build, start, and run all e2e specs headlessly
    (CI-ready). If port 3000 is already in use by something other than your
    local dev server, stop it first — Playwright's `webServer` needs the
    port and only reuses an existing server outside of `CI`.

## Authentication

The whole app sits behind a lightweight single-user gate: one password
(stored as a scrypt hash in an env var), a signed session cookie, no user
accounts, no database. Set `SESSION_SECRET` and `AUTH_PASSWORD_HASH` (see
`.env.example`; generate the hash with `pnpm auth:hash`). Full details in
[`docs/auth.md`](docs/auth.md).

## Database

Postgres on [Neon](https://neon.tech), accessed through
[Drizzle ORM](https://orm.drizzle.team) with a plain-SQL migration workflow
(`pnpm db:generate` / `pnpm db:migrate` / `pnpm db:studio`). See
[`docs/database.md`](docs/database.md) for env vars, the full migration
workflow, and known gaps. `GET /api/health` verifies the connection is live.

## Versioning

The project version in `package.json` is bumped once per feature, semver
driven by the branch's Conventional Commits: `feat` → minor, `fix` → patch,
a `!` marker or `BREAKING CHANGE:` footer → major. Every other branch
(`chore`/`docs`/`test`/`refactor`/`style`-only) still owes a patch bump, so
every PR carries exactly one version bump.

Convention for the branch that implements a feature:

1. Bump with `pnpm version <level> --no-git-tag-version` and commit the
   result as `chore(release): v<X.Y.Z>` — the final commit on the branch.
2. Run `pnpm version:check` to confirm the bump is present against `develop`,
   is exactly one semver step, and is at least the level the branch's
   commits require.

No git tags or CHANGELOG are generated — GitHub's compare view covers
history for this single-user repo. See `AGENTS.md` for the full workflow
contract this fits into.

## CI

Every PR targeting `develop` or `main` (and every push to those branches) runs
[`.github/workflows/ci.yml`](.github/workflows/ci.yml) as four parallel jobs,
each surfaced as its own status check on the PR:

| Job       | What it runs                                                  |
| --------- | ------------------------------------------------------------- |
| `quality` | `pnpm lint` → `pnpm format:check` → `pnpm typecheck`          |
| `unit`    | `pnpm test`                                                   |
| `build`   | `pnpm build`                                                  |
| `e2e`     | `pnpm test:e2e` (builds and serves a production build itself) |

The `e2e` job uploads the Playwright HTML report as a build artifact if any
spec fails. `develop` and `main` both require all four checks to pass before a
PR can be merged. Reproduce any of them locally with the matching `pnpm`
script from the [Code quality](#code-quality) and [Testing](#testing) tables
above.

## License

[MIT](LICENSE)
