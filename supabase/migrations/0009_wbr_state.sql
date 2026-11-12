-- The working state of a brand's Weekly Business Review: scorecard targets, who owns each
-- group of numbers, the one line written against each exception, and the board (tasks, issues,
-- needs, decisions). One JSON document per brand, same shape as forecast_inputs.
create table if not exists wbr_state (
  tenant_id uuid primary key references tenants(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table wbr_state enable row level security;
drop policy if exists wbr_state_read on wbr_state;
create policy wbr_state_read on wbr_state for select to authenticated using (is_member(tenant_id));
drop policy if exists wbr_state_write on wbr_state;
create policy wbr_state_write on wbr_state for all to authenticated using (can_write(tenant_id)) with check (can_write(tenant_id));
