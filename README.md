# Renaissance Commerce — student app

`app.renaissancecommerce.com`. Multi-tenant platform where program students connect their store and ad account once and see their numbers and creative in the course's own vocabulary. Coaches see every brand in an admin view.

## What's here (Phase 1)

| Module | Route | Status |
|---|---|---|
| Onboarding wizard | `/onboarding` | brand → connect → costs → offers → positioning; save-and-resume |
| Brand Book | `/brand-book` | versioned JSON, markdown export, naming-convention validator, reading-grade check |
| Unit Economics & Cash Flow | `/unit-economics` | per-offer margin, 85% rule, allowable NCPA, 6-month cash projection and runway |
| Weekly Business Review | `/wbr` | last complete week vs prior, commentary (Claude or template), cohorts, CS reasons |
| Inventory Planning & Forecast | `/inventory` | spend-scaled demand, stock-out and reorder dates, suggested PO, supplier table |
| Creative Performance | `/creative` | ad-level Meta insights parsed by the naming convention; winners, fatigue, hit rate, velocity |
| Admin / Coach view | `/admin`, `/admin/[tenant]` | every tenant, flags, connections, call-prep page, notes, review annotation |
| Connections | `/integrations` | Shopify + Meta OAuth, Triple Whale / Lifetimely / Commslayer keys |

**Integrations:** `src/lib/integrations/` — one connector per system with `test()` and `pull()`. `workers/sync.ts` runs them hourly (and the 24-month backfill nightly); `workers/wbr.ts` writes and emails the Monday review.

**Data layer:** `src/lib/data/` — one `DataSource` interface, two implementations. `DemoSource` serves three invented brands (Glowbright Labs, Harbor & Pine, Ridgeline Supply) with generated history so every screen can be clicked through before any store is connected. `SupabaseSource` reads the real tables under RLS.

**Calculations:** `src/lib/calc/` — pure functions, no I/O, unit-testable. `unit-economics.ts` (margin model + cash flow), `inventory.ts` (forecast), `creative.ts` (taxonomy parsing and rollups), `wbr.ts` (week rollup, flags, template commentary). `src/lib/snapshot.ts` assembles everything a page needs for one tenant in one call.

## Run it

```bash
cp .env.example .env.local        # DEMO_MODE=true by default
npm install
npm run dev                       # http://localhost:3000 — pick "Enter as coach" or "Enter as a student"
```

With `NEXT_PUBLIC_SUPABASE_URL` set and `DEMO_MODE=false`, the app uses Supabase Auth (magic link) and the real tables.

## Deploy

1. **Database.** Apply `supabase/migrations/0001_schema.sql` then `0002_rls.sql` to the shared Supabase project (same one as the Private Circle platform; the new tables don't touch its tables). Add coaches with `insert into app_roles (user_id, role) values ('<auth user id>', 'coach')`.
2. **OAuth apps.** Create a Shopify app (scopes in `src/lib/integrations/shopify.ts`, redirect `https://app.renaissancecommerce.com/api/integrations/shopify/callback`) and a Meta app with `ads_read` (redirect `.../api/integrations/meta/callback`; App Review is needed before non-admin students can connect).
3. **Secrets.** `openssl rand -base64 32` → `INTEGRATIONS_ENCRYPTION_KEY`. Set every `sync: false` variable from `render.yaml` in the Render dashboard.
4. **Render.** `render.yaml` defines the web service and three cron jobs (hourly sync, nightly backfill, Monday WBR). Point `app.renaissancecommerce.com` at the web service.
5. **Stripe.** Add a webhook for subscription events to `/api/webhooks/stripe`; include the student's email and tier in subscription metadata.

## Guarantees the spec asked for

- **Tenant isolation.** Every table carries `tenant_id` with RLS; coaches are recognised through `app_roles`; the service role is used only by workers and OAuth callbacks.
- **Secrets.** Tokens and keys are AES-256-GCM encrypted in `integrations.credentials_enc`; the column is not readable by the API roles at all.
- **No holdco data.** Nothing in the UI, seed data, placeholders or examples references the holdco's brands or products. `grep -ri "maia\|avia" src workers supabase` returns nothing.
- **Plain language.** Provider errors are translated in `plainError()` before they reach a student; raw messages go to server logs only.
- **Traceability.** Every stat has a hover formula (`FORMULAS` in `unit-economics.ts`); tables export via the browser.
- **PII minimised.** The Shopify sync stores customer ids and counts, never names or emails.

## Onboarding a new student (coach runbook)

1. Student signs up on the Private Circle platform → Stripe webhook marks their email active.
2. They visit `app.renaissancecommerce.com`, get a magic link, and the wizard creates their tenant.
3. After Shopify connects, the hourly job picks them up; the nightly backfill loads 24 months. Progress shows on their Connections page and in `/admin`.
4. If a connection shows an error in `/admin`, the student reconnects from Connections; Slack gets a digest if `SLACK_WEBHOOK_URL` is set.

## Adding an integration

Create `src/lib/integrations/<name>.ts` implementing `Connector<T>`, add the provider to `PROVIDERS` in `store.ts` and the `integrations.provider` check constraint, add a case to `pullAndWrite()` in `workers/sync.ts`, and add a card to `/integrations`.

## Phase 2 / 3 hooks already in place

- `usage_meter` table for LLM/Atria credit metering per tenant.
- `audit_log` trigger on every student-editable input.
- `brand_book_versions` history for the coach "what changed" view.
- `tenant_access.tier` for Skool read-only access.
