<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## PTForge project rules

- Multi-tenant SaaS for personal trainers and coaches. Tenant = Better Auth "organization"; URL `/<tenant-slug>/...`.
- ALL tenant data access goes through `withTenant(ctx, tx => ...)` in `src/server/db/tenant.ts`. Never query tenant tables with the plain `db` export from page or action code.
- Get `ctx` from `requireTenant(slug)` in `src/server/auth/session.ts`. Check actions with `can(ctx.roles, {...})` from `src/server/auth/permissions.ts` before writing.
- Roles: admin, manager, trainer, athlete (a member may hold several, comma separated). Platform owner is `user.role = "platform_owner"`.
- New tenant table: `tenantId()` column, a custom migration enabling RLS with policies and `GRANT ... TO ptforge_app`, and a test in `tests/tenant-isolation.test.ts`.
- Never use `drizzle-kit push`; use `pnpm db:generate` then `pnpm db:migrate`.
- Weights are stored in kg (display unit is a user preference). Passwords: 16+ characters.
- Before finishing: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
