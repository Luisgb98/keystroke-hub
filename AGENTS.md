<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Keystroke Hub — Agent Contract

Single-user personal app for a full-stack developer who is also a gaming content creator. Two worlds: **work life** (tasks, daily/weekly logs, meetings, projects) and **content creation** (video ideas, scripts, video/stream schedule). Both share one calendar UI but are strictly separated tracks. The repo is **public**: never commit secrets, keep `.env.example` current, keep the README presentable.

## Tech stack

- **Next.js (App Router) + React** — always the latest stable versions of every dependency; re-check what's current when the work happens, never assume.
- **Tailwind CSS + shadcn/ui** for all UI.
- **Postgres on Neon**, deployed on **Vercel**.
- **pnpm only** — never npm or yarn; only `pnpm-lock.yaml` may exist.
- TypeScript everywhere.

## Non-negotiables

- **Testing is mandatory**: every feature ships with unit tests, plus e2e tests wherever there's a meaningful user flow. No tests → not done.
- **Mobile-first**, fully usable on desktop.
- **Design is a first-class concern**: follow the project design system (foundation issue); nothing should look like a generic admin template.
- **Conventional Commits** on every commit (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`, …).

## Execution workflow

1. Every feature lives as **one GitHub Issue** in this repo. Issue bodies describe **what & why** only (scope, user story, acceptance criteria) — never stack/schema/API design.
2. Implement a feature **only** when the owner explicitly requests it by Issue number (e.g. "implement Issue #12" / "plan Issue #12"). Never start feature work unprompted.
3. Implementing means: build it completely, write & pass unit tests, write & pass e2e tests where relevant, and make **all pipelines green** — lint, format check, type-check, unit tests, e2e tests, build.
4. When green, open a **Pull Request targeting `develop`** — never `main`/`master` directly.
5. **Never merge the PR.** Merging is always the owner's decision; the agent's job ends at "PR open and green."
6. Assign **`Luisgb98`** (repo owner) as assignee on every Issue and PR.
7. Set correct metadata everywhere: type label (`type:feature`, `type:bug`, `type:chore`, …), epic label (`epic:*`), milestone, and link the PR to its originating Issue (`Closes #X`).
8. All commits follow Conventional Commits (see Non-negotiables).
9. **Bump the project version once per feature**, semver driven by the commit type: `feat` → minor, `fix` → patch, breaking change → major. The concrete mechanism is defined in the versioning foundation Issue — follow it once it lands.
