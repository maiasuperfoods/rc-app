-- A brand's place on the roadmap: where it started, which steps it ticked by hand and which it
-- set aside. Most progress is read from the brand's own data and is not stored here.
create table if not exists roadmap_state (
  tenant_id uuid primary key references tenants(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table roadmap_state enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'roadmap_state' and policyname = 'roadmap_state_read') then
    create policy roadmap_state_read on roadmap_state for select to authenticated using (is_member(tenant_id));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'roadmap_state' and policyname = 'roadmap_state_write') then
    create policy roadmap_state_write on roadmap_state for all to authenticated using (can_write(tenant_id)) with check (can_write(tenant_id));
  end if;
end $$;
