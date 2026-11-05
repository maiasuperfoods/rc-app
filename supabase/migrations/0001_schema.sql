-- app.renaissancecommerce.com — schema
-- Applies to the Supabase project shared with the Private Circle platform.
-- Everything is namespaced under tables prefixed with nothing but scoped by tenant_id;
-- no table here touches the Private Circle tables, and auth.users is shared.

create extension if not exists "pgcrypto";

-- ---- roles and tenancy ------------------------------------------------------

create table if not exists app_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('coach','admin')),
  created_at timestamptz not null default now()
);

create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text,
  logo_url text,
  stage text not null default 'grind' check (stage in ('grind','validation','acceleration','expansion')),
  tier text not null default 'ic' check (tier in ('ic','skool','trial')),
  currency text not null default 'USD',
  timezone text not null default 'America/New_York',
  onboarding_complete boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists tenant_members (
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'student' check (role in ('student','coach','admin')),
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);
create index if not exists tenant_members_user_idx on tenant_members(user_id);

-- Entitlements mirrored from Stripe / Skool webhooks (by email, before the user exists in auth).
create table if not exists tenant_access (
  email text primary key,
  active boolean not null default true,
  tier text not null default 'ic',
  cancelled_at timestamptz,
  updated_at timestamptz not null default now()
);

-- ---- catalogue and economics inputs -----------------------------------------

create table if not exists products (
  id text primary key,                      -- Shopify GID or app-generated
  tenant_id uuid not null references tenants(id) on delete cascade,
  title text not null,
  shopify_product_id text,
  active boolean not null default true
);
create index if not exists products_tenant_idx on products(tenant_id);

create table if not exists skus (
  id text primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  product_id text references products(id) on delete set null,
  sku text not null,
  variant_title text not null default '',
  shopify_variant_id text,
  landed_cost numeric(12,4) not null default 0,
  units_per_pack int not null default 1
);
create index if not exists skus_tenant_idx on skus(tenant_id);

create table if not exists cost_inputs (
  tenant_id uuid primary key references tenants(id) on delete cascade,
  outbound_shipping_per_order numeric(10,2) not null default 5.20,
  fulfillment_per_order numeric(10,2) not null default 2.10,
  fulfillment_per_unit numeric(10,2) not null default 0.35,
  processing_rate numeric(6,4) not null default 0.029,
  processing_fixed numeric(10,2) not null default 0.30,
  buffer_rate numeric(6,4) not null default 0.07,
  refund_rate numeric(6,4) not null default 0.04,
  chargeback_rate numeric(6,4) not null default 0.004,
  target_margin_rule numeric(6,4) not null default 0.85,
  updated_at timestamptz not null default now()
);

create table if not exists offers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  price numeric(10,2) not null,
  sku_id text references skus(id) on delete set null,
  units_shipped int not null default 1,
  is_default boolean not null default false
);
create index if not exists offers_tenant_idx on offers(tenant_id);

create table if not exists upsells (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  price numeric(10,2) not null,
  cogs numeric(10,2) not null default 0,
  take_rate numeric(6,4) not null default 0
);
create index if not exists upsells_tenant_idx on upsells(tenant_id);

create table if not exists opex_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  monthly numeric(12,2) not null default 0
);
create index if not exists opex_tenant_idx on opex_lines(tenant_id);

-- ---- inventory --------------------------------------------------------------

create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  sku_id text references skus(id) on delete cascade,
  name text not null,
  lead_time_days int not null default 30,
  moq int not null default 0,
  payment_terms text
);
create index if not exists suppliers_tenant_idx on suppliers(tenant_id);

create table if not exists inventory_levels (
  tenant_id uuid not null references tenants(id) on delete cascade,
  sku_id text not null references skus(id) on delete cascade,
  on_hand int not null default 0,
  daily_velocity_30 numeric(12,4) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, sku_id)
);

create table if not exists purchase_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  sku_id text references skus(id) on delete cascade,
  quantity int not null,
  eta date not null,
  po_number text,
  received boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists po_tenant_idx on purchase_orders(tenant_id);

create table if not exists spend_plans (
  tenant_id uuid not null references tenants(id) on delete cascade,
  month text not null,                       -- 'YYYY-MM'
  spend numeric(12,2) not null default 0,
  primary key (tenant_id, month)
);

-- ---- forecast model inputs (one JSON document per tenant; versions in audit_log) ---

create table if not exists forecast_inputs (
  tenant_id uuid primary key references tenants(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---- brand book (versioned JSON) ---------------------------------------------

create table if not exists brand_books (
  tenant_id uuid primary key references tenants(id) on delete cascade,
  version int not null default 1,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists brand_book_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  version int not null,
  data jsonb not null,
  author_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists bbv_tenant_idx on brand_book_versions(tenant_id, version desc);

-- ---- integrations and ingestion -----------------------------------------------

create table if not exists integrations (
  tenant_id uuid not null references tenants(id) on delete cascade,
  provider text not null check (provider in ('shopify','meta','triple_whale','lifetimely','commslayer')),
  connected boolean not null default false,
  credentials_enc text,                      -- AES-256-GCM, service role only (see RLS)
  external_id text,
  last_sync_at timestamptz,
  last_error text,
  backfill_progress numeric(4,3),
  created_at timestamptz not null default now(),
  primary key (tenant_id, provider)
);

create table if not exists sync_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  provider text not null,
  status text not null default 'running',
  rows_written int,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists sync_jobs_tenant_idx on sync_jobs(tenant_id, started_at desc);

create table if not exists daily_business_metrics (
  tenant_id uuid not null references tenants(id) on delete cascade,
  date date not null,
  revenue numeric(14,2) not null default 0,
  orders int not null default 0,
  new_customers int not null default 0,
  returning_customers int not null default 0,
  ad_spend numeric(14,2) not null default 0,
  refunds numeric(14,2) not null default 0,
  cogs numeric(14,2) not null default 0,
  source text not null default 'shopify',   -- 'triple_whale' is business truth and wins
  primary key (tenant_id, date)
);

create table if not exists ad_daily_insights (
  tenant_id uuid not null references tenants(id) on delete cascade,
  date date not null,
  ad_id text not null,
  ad_name text not null,
  ad_set_id text,
  ad_set_name text,
  campaign_id text,
  campaign_name text,
  status text not null default 'ACTIVE',
  format text not null default 'Video',
  thumbnail_url text,
  spend numeric(14,2) not null default 0,
  impressions bigint not null default 0,
  clicks int not null default 0,
  link_clicks int not null default 0,
  meta_purchases int not null default 0,      -- platform-reported
  meta_revenue numeric(14,2) not null default 0,
  tw_purchases int not null default 0,        -- Triple Whale pixel, all customers
  tw_revenue numeric(14,2) not null default 0,
  nc_purchases int not null default 0,        -- Triple Whale pixel, new customers (decides winners)
  nc_revenue numeric(14,2) not null default 0,
  plays_3s int,
  thruplays int,
  new_visitors int,
  unique_visitors int,
  launched_at date,
  primary key (tenant_id, date, ad_id)
);
create index if not exists ad_insights_ad_idx on ad_daily_insights(tenant_id, ad_id);

-- ClickUp brief pipeline for the Creative Output view (status dates only, never task bodies)
create table if not exists creative_tasks (
  tenant_id uuid not null references tenants(id) on delete cascade,
  task_id text not null,
  name text not null,
  strategist text,
  editors text[] not null default '{}',
  product text,
  kind text not null default 'Video',
  status text not null,
  brief_date date,
  ready_date date,
  closed_date date,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, task_id)
);

create table if not exists cohorts (
  tenant_id uuid not null references tenants(id) on delete cascade,
  cohort_month text not null,
  customers int not null default 0,
  ltv30 numeric(12,2) not null default 0,
  ltv60 numeric(12,2) not null default 0,
  ltv90 numeric(12,2) not null default 0,
  ltv180 numeric(12,2) not null default 0,
  repurchase_rate numeric(6,4) not null default 0,
  source text not null default 'shopify',
  primary key (tenant_id, cohort_month)
);

create table if not exists daily_support_metrics (
  tenant_id uuid not null references tenants(id) on delete cascade,
  date date not null,
  tickets int not null default 0,
  first_response_minutes numeric(10,2) not null default 0,
  refund_requests int not null default 0,
  chargeback_alerts int not null default 0,
  top_reasons jsonb not null default '[]'::jsonb,
  primary key (tenant_id, date)
);

-- ---- WBR, notes, audit ---------------------------------------------------------

create table if not exists wbr_reports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  metrics jsonb not null,
  previous jsonb not null,
  commentary text not null,
  generated_at timestamptz not null default now(),
  coach_annotation text,
  unique (tenant_id, week_start)
);

create table if not exists coach_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  author_id uuid references auth.users(id),
  author_name text not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists coach_notes_tenant_idx on coach_notes(tenant_id, created_at desc);

create table if not exists audit_log (
  id bigserial primary key,
  tenant_id uuid,
  user_id uuid,
  table_name text not null,
  record_id text,
  action text not null,
  diff jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_tenant_idx on audit_log(tenant_id, created_at desc);

create table if not exists usage_meter (
  tenant_id uuid not null references tenants(id) on delete cascade,
  month text not null,
  llm_input_tokens bigint not null default 0,
  llm_output_tokens bigint not null default 0,
  atria_credits numeric(12,2) not null default 0,
  primary key (tenant_id, month)
);

-- ---- audit trigger for the inputs a coach cares about ----------------------------

create or replace function audit_row() returns trigger language plpgsql security definer as $$
begin
  insert into audit_log(tenant_id, user_id, table_name, record_id, action, diff)
  values (
    coalesce(new.tenant_id, old.tenant_id),
    auth.uid(),
    tg_table_name,
    coalesce(to_jsonb(new)->>'id', to_jsonb(new)->>'tenant_id', to_jsonb(old)->>'id'),
    tg_op,
    case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;

do $$ declare t text; begin
  foreach t in array array['cost_inputs','offers','skus','opex_lines','suppliers','spend_plans','brand_books','forecast_inputs'] loop
    execute format('drop trigger if exists audit_%s on %s', t, t);
    execute format('create trigger audit_%s after insert or update or delete on %s for each row execute function audit_row()', t, t);
  end loop;
end $$;
