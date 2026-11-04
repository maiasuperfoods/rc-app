-- Row Level Security. Every table has tenant_id and every table is locked:
--   students see only tenants they belong to,
--   coaches/admins (app_roles) see everything,
--   the service role (workers) bypasses RLS by design and its use is audited via sync_jobs.
-- Credentials are never readable from the browser: the anon/authenticated role
-- has no SELECT on integrations.credentials_enc (column grant below).

create or replace function is_coach() returns boolean language sql stable security definer as $$
  select exists (select 1 from app_roles where user_id = auth.uid());
$$;

create or replace function is_member(t uuid) returns boolean language sql stable security definer as $$
  select exists (select 1 from tenant_members where tenant_id = t and user_id = auth.uid()) or is_coach();
$$;

-- app_roles: a user may read their own role; only service role writes.
alter table app_roles enable row level security;
drop policy if exists app_roles_self on app_roles;
create policy app_roles_self on app_roles for select using (user_id = auth.uid());

-- tenants
alter table tenants enable row level security;
drop policy if exists tenants_read on tenants;
create policy tenants_read on tenants for select using (is_member(id));
drop policy if exists tenants_insert on tenants;
create policy tenants_insert on tenants for insert with check (auth.uid() is not null);
drop policy if exists tenants_update on tenants;
create policy tenants_update on tenants for update using (is_member(id));

-- tenant_members: read own memberships (and all, for coaches); a user may add themselves as owner of a tenant they just created
alter table tenant_members enable row level security;
drop policy if exists members_read on tenant_members;
create policy members_read on tenant_members for select using (user_id = auth.uid() or is_coach());
drop policy if exists members_insert_self on tenant_members;
create policy members_insert_self on tenant_members for insert with check (user_id = auth.uid() and not exists (select 1 from tenant_members m where m.tenant_id = tenant_members.tenant_id));
drop policy if exists members_coach_write on tenant_members;
create policy members_coach_write on tenant_members for all using (is_coach()) with check (is_coach());

alter table tenant_access enable row level security;  -- service role only

-- generic tenant-scoped policies
do $$ declare t text; begin
  foreach t in array array[
    'products','skus','cost_inputs','offers','upsells','opex_lines','suppliers','inventory_levels',
    'purchase_orders','spend_plans','brand_books','brand_book_versions','integrations','sync_jobs',
    'daily_business_metrics','ad_daily_insights','cohorts','daily_support_metrics','wbr_reports','usage_meter'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I_tenant_read on %I', t, t);
    execute format('create policy %I_tenant_read on %I for select using (is_member(tenant_id))', t, t);
  end loop;
  -- tables students may write
  foreach t in array array['products','skus','cost_inputs','offers','upsells','opex_lines','suppliers','purchase_orders','spend_plans','brand_books','brand_book_versions'] loop
    execute format('drop policy if exists %I_tenant_write on %I', t, t);
    execute format('create policy %I_tenant_write on %I for all using (is_member(tenant_id)) with check (is_member(tenant_id))', t, t);
  end loop;
  -- coach-only writes
  foreach t in array array['wbr_reports'] loop
    execute format('drop policy if exists %I_coach_write on %I', t, t);
    execute format('create policy %I_coach_write on %I for update using (is_coach()) with check (is_coach())', t, t);
  end loop;
end $$;

-- coach notes: coaches only, both ways
alter table coach_notes enable row level security;
drop policy if exists notes_coach on coach_notes;
create policy notes_coach on coach_notes for all using (is_coach()) with check (is_coach());

-- audit log: coaches read; writes come from the security-definer trigger
alter table audit_log enable row level security;
drop policy if exists audit_coach_read on audit_log;
create policy audit_coach_read on audit_log for select using (is_coach());

-- Secrets: strip the column from what the API roles can read. Workers use service_role.
revoke select (credentials_enc) on integrations from anon, authenticated;
grant select (tenant_id, provider, connected, external_id, last_sync_at, last_error, backfill_progress, created_at) on integrations to authenticated;

-- Performance: nightly pre-aggregation lives in the workers; these indexes cover the dashboards.
create index if not exists dbm_tenant_date_idx on daily_business_metrics(tenant_id, date desc);
create index if not exists adi_tenant_date_idx on ad_daily_insights(tenant_id, date desc);
create index if not exists dsm_tenant_date_idx on daily_support_metrics(tenant_id, date desc);
