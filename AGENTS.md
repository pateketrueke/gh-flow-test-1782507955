# AGENTS.md — SDLC Eval Sandbox

Minimal TypeScript sandbox for weekend SDLC evaluation. Agents work here; orchestration lives in the parent umbrella repo (`dot5/WEEKEND_EVAL.md`).

## Commands

```bash
pnpm install
pnpm lint          # ESLint
pnpm typecheck     # tsc --noEmit
pnpm test          # Vitest
```

## Board Transitions

```bash
./scripts/transition.sh <issue-number> <status>
```

Statuses: `Todo`, `Planning`, `"In Progress"`, `"In Review"`, `Done`

- **Todo → Planning:** when you start writing the plan
- **Planning → In Progress:** when you start coding
- **In Progress → In Review:** automatic when PR is opened (GitHub Actions)
- **In Review → Done:** automatic when PR is merged (GitHub Actions)

## SDLC Workflow

Follow the ai-sdlc framework starting at Step 6 (detailed execution plan):

1. Read the story from the GitHub issue (`gh issue view <number>`)
2. Write a plan, transition to **Planning**
3. Implement + write tests, transition to **In Progress**
4. `pnpm lint && pnpm typecheck && pnpm test` — all must pass
5. Push branch, open PR referencing the issue (e.g. `Closes #4`)
6. Board auto-transitions to **In Review** on PR open, **Done** on merge

## Project Board

https://github.com/users/pateketrueke/projects/2

## Stories

| Track | Issue | Description |
|-------|-------|-------------|
| A (Backend) | #4 | Provision connected accounts via Accounts v2 |
| B (Frontend) | #5 | Style Stripe Elements to match design system |
