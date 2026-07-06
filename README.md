# Keystroke Hub

A single-user personal app for a full-stack developer who is also a gaming
content creator. It keeps two worlds side by side without mixing them:

- **Work life** — tasks, daily/weekly logs, meetings, projects.
- **Content creation** — video ideas, scripts, video/stream schedule.

Both tracks share one calendar UI but stay strictly separated everywhere else.

## Tech stack

- [Next.js](https://nextjs.org) (App Router) + React
- Tailwind CSS + [shadcn/ui](https://ui.shadcn.com)
- Postgres on [Neon](https://neon.tech), deployed on [Vercel](https://vercel.com)
- TypeScript

## Getting started

This project uses **pnpm only** — do not use npm or yarn.

```bash
pnpm install
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

## Learn more

- [Next.js Documentation](https://nextjs.org/docs)
- [shadcn/ui Documentation](https://ui.shadcn.com/docs)
