-- Student app (live). Applied 6 Nov 2026 to the dedicated Supabase project `rc-student-app`
-- (uxzhwttxmwwpezxbagpi), after 0001_schema.sql. Replaces 0002_rls.sql for that project.
-- Access: students read/write only brands they belong to; coaches read every brand, write none
-- (except their own WBR annotation and coach notes). Accounts, brands and memberships are created
-- only by the `admin` edge function (service role). Course content stays in the content project.

create or replace function is_coach() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from app_roles where user_id = auth.uid());
$$;
create or replace function is_member(t uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from tenant_members where tenant_id = t and user_id = auth.uid()) or is_coach();
$$;
create or replace function can_write(t uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from tenant_members where tenant_id = t and user_id = auth.uid() and role = 'student');
$$;

alter table app_roles enable row level security;
create policy app_roles_self on app_roles for select to authenticated using (user_id = auth.uid());
alter table tenants enable row level security;
create policy tenants_read on tenants for select to authenticated using (is_member(id));
create policy tenants_update on tenants for update to authenticated using (can_write(id)) with check (can_write(id));
alter table tenant_members enable row level security;
create policy members_read on tenant_members for select to authenticated using (user_id = auth.uid() or is_coach());
alter table tenant_access enable row level security;

do $$ declare t text; begin
  foreach t in array array['products','skus','cost_inputs','offers','upsells','opex_lines','suppliers','inventory_levels',
    'purchase_orders','spend_plans','brand_books','brand_book_versions','forecast_inputs','integrations','sync_jobs',
    'daily_business_metrics','ad_daily_insights','creative_tasks','cohorts','daily_support_metrics','wbr_reports','usage_meter'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I_read on %I for select to authenticated using (is_member(tenant_id))', t, t);
  end loop;
  foreach t in array array['products','skus','cost_inputs','offers','upsells','opex_lines','suppliers','purchase_orders','spend_plans','brand_books','brand_book_versions','forecast_inputs'] loop
    execute format('create policy %I_write on %I for all to authenticated using (can_write(tenant_id)) with check (can_write(tenant_id))', t, t);
  end loop;
end $$;

alter table coach_notes enable row level security;
create policy notes_coach on coach_notes for all to authenticated using (is_coach()) with check (is_coach());
alter table audit_log enable row level security;
create policy audit_coach_read on audit_log for select to authenticated using (is_coach());
revoke select (credentials_enc) on integrations from anon, authenticated;

revoke update on wbr_reports from authenticated;
grant update (coach_annotation) on wbr_reports to authenticated;
create policy wbr_reports_coach_annotate on wbr_reports for update to authenticated using (is_coach()) with check (is_coach());

create table if not exists kb_lesson_progress (
  user_id uuid not null references auth.users(id) on delete cascade, lesson_id uuid not null,
  completed_at timestamptz not null default now(), primary key (user_id, lesson_id)
);
alter table kb_lesson_progress enable row level security;
create policy kb_progress_own_read on kb_lesson_progress for select to authenticated using (user_id = auth.uid());
create policy kb_progress_own_insert on kb_lesson_progress for insert to authenticated with check (user_id = auth.uid());
create policy kb_progress_own_delete on kb_lesson_progress for delete to authenticated using (user_id = auth.uid());

create table if not exists setup_codes (code_sha256 text primary key, created_at timestamptz not null default now());
alter table setup_codes enable row level security;
create table if not exists invites (
  id uuid primary key default gen_random_uuid(), email text not null, tenant_id uuid references tenants(id) on delete cascade,
  role text not null check (role in ('student','coach')), invited_by uuid references auth.users(id),
  created_at timestamptz not null default now(), accepted_at timestamptz
);
alter table invites enable row level security;
create policy invites_coach_read on invites for select to authenticated using (is_coach());

revoke execute on function audit_row() from public, anon, authenticated;
revoke execute on function is_coach() from public, anon;
revoke execute on function is_member(uuid) from public, anon;
revoke execute on function can_write(uuid) from public, anon;
grant execute on function is_coach() to authenticated;
grant execute on function is_member(uuid) to authenticated;
grant execute on function can_write(uuid) to authenticated;
