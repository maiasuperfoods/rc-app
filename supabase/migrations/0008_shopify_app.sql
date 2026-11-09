-- Shopify public-app support: installs that start on Shopify's side (App Store / admin) arrive
-- without a signed-in student, so the access token is parked here until someone links it to a brand.
create table if not exists shopify_pending_installs (
  shop text primary key,
  credentials_enc text not null,
  scopes text not null,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  claimed_tenant_id uuid references tenants(id) on delete set null
);
alter table shopify_pending_installs enable row level security;
revoke all on shopify_pending_installs from anon, authenticated;

-- Audit trail for Shopify's mandatory compliance webhooks. Reviewers ask how requests are handled;
-- this is the record. No customer payload is stored, only the shop and the topic.
create table if not exists shopify_compliance_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  topic text not null,
  shop text,
  tenant_id uuid references tenants(id) on delete set null,
  outcome text not null
);
alter table shopify_compliance_log enable row level security;
revoke all on shopify_compliance_log from anon, authenticated;

create index if not exists shopify_compliance_log_shop_idx on shopify_compliance_log (shop, created_at desc);
