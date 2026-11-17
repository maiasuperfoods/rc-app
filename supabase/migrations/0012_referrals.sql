-- Referral partners: students request access, staff approve, send the link and track commissions.
-- Commission terms, contacts, agreements and payments are staff-only; students see the partner
-- directory and their own brand's requests.

create table if not exists referral_staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  added_by uuid,
  created_at timestamptz not null default now()
);
alter table referral_staff enable row level security;

create or replace function is_referral_staff() returns boolean language sql stable security definer set search_path = public as $$
  select is_coach() or exists (select 1 from referral_staff where user_id = auth.uid());
$$;

create table if not exists referral_partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'Other',
  description text not null default '',
  website text,
  listed boolean not null default true,
  created_at timestamptz not null default now()
);
alter table referral_partners enable row level security;

create table if not exists referral_partner_terms (
  partner_id uuid primary key references referral_partners(id) on delete cascade,
  contact_name text, contact_email text, contact_phone text,
  agreement_status text not null default 'none' check (agreement_status in ('none','in_talks','agreed')),
  commission_rate text,
  commission_type text not null default 'unknown' check (commission_type in ('unknown','one_time','recurring')),
  how_collected text,
  payout_schedule text,
  referral_link text,
  referral_code text,
  verify_where text,
  notes text,
  agreement_path text, agreement_name text, agreement_date date,
  updated_at timestamptz not null default now()
);
alter table referral_partner_terms enable row level security;

create table if not exists referral_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete set null,
  partner_id uuid not null references referral_partners(id) on delete restrict,
  requested_by uuid,
  requester_email text not null default '',
  requester_name text not null default '',
  tenant_name text not null default '',
  note text not null default '',
  status text not null default 'requested' check (status in ('requested','sent','declined')),
  access_link text, access_code text, message text,
  decided_by uuid, decided_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists referral_requests_one_open on referral_requests (tenant_id, partner_id) where status <> 'declined';
create index if not exists referral_requests_partner on referral_requests (partner_id);
alter table referral_requests enable row level security;

create table if not exists referral_tracking (
  request_id uuid primary key references referral_requests(id) on delete cascade,
  signed_up_on date,
  vendor_ref text,
  follow_up_on date,
  notes text,
  updated_at timestamptz not null default now()
);
alter table referral_tracking enable row level security;

create table if not exists referral_payments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references referral_requests(id) on delete cascade,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'USD',
  period text,
  status text not null default 'due' check (status in ('due','paid')),
  due_on date, paid_on date,
  reference text, notes text,
  created_at timestamptz not null default now()
);
create index if not exists referral_payments_request on referral_payments (request_id);
alter table referral_payments enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'referral_staff' and policyname = 'referral_staff_read') then
    create policy referral_staff_read on referral_staff for select to authenticated using (user_id = auth.uid() or is_coach());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'referral_partners' and policyname = 'referral_partners_read') then
    create policy referral_partners_read on referral_partners for select to authenticated using (listed or is_referral_staff());
    create policy referral_partners_write on referral_partners for all to authenticated using (is_referral_staff()) with check (is_referral_staff());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'referral_partner_terms' and policyname = 'referral_terms_staff') then
    create policy referral_terms_staff on referral_partner_terms for all to authenticated using (is_referral_staff()) with check (is_referral_staff());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'referral_requests' and policyname = 'referral_requests_read') then
    create policy referral_requests_read on referral_requests for select to authenticated using (is_member(tenant_id) or is_referral_staff());
    create policy referral_requests_ask on referral_requests for insert to authenticated with check (
      can_write(tenant_id) and requested_by = auth.uid() and status = 'requested'
      and access_link is null and access_code is null and message is null and decided_at is null and decided_by is null
    );
    create policy referral_requests_staff on referral_requests for update to authenticated using (is_referral_staff()) with check (is_referral_staff());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'referral_tracking' and policyname = 'referral_tracking_staff') then
    create policy referral_tracking_staff on referral_tracking for all to authenticated using (is_referral_staff()) with check (is_referral_staff());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'referral_payments' and policyname = 'referral_payments_staff') then
    create policy referral_payments_staff on referral_payments for all to authenticated using (is_referral_staff()) with check (is_referral_staff());
  end if;
end $$;

-- Signed agreements: private bucket, staff only.
insert into storage.buckets (id, name, public) values ('partner-agreements', 'partner-agreements', false) on conflict (id) do nothing;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'partner_agreements_staff') then
    create policy partner_agreements_staff on storage.objects for all to authenticated
      using (bucket_id = 'partner-agreements' and public.is_referral_staff())
      with check (bucket_id = 'partner-agreements' and public.is_referral_staff());
  end if;
end $$;

-- Starting partner list.
do $$
declare r record; pid uuid;
begin
  if exists (select 1 from referral_partners) then return; end if;
  for r in select * from (values
    ('Leo','Payment Processing',null,'none',null),
    ('Adyen','Payment Processing',null,'none',null),
    ('PayArc','Payment Processing','Doug','agreed','10%'),
    ('Cliq / MPI / Nexio','Payment Processing','Levi Massey','none',null),
    ('Slash','Banking and Cards',null,'none',null),
    ('Sume.com','AI Generation',null,'none',null),
    ('CheckoutChamp','Checkout',null,'agreed','10%'),
    ('Savant Media Retention','Retention','Ayush','in_talks','15%'),
    ('Alia','Retention',null,'none',null),
    ('Our own 3PL','Fulfillment',null,'agreed',null),
    ('EcomFlow','Fulfillment',null,'none',null),
    ('Phantom Stays','Travel Point Hacking',null,'none',null),
    ('Saadie (CPA)','Accounting','Sadie','none',null),
    ('Falkyn.io','Other',null,'in_talks','20%'),
    ('AdRevival / Revive','Ad Accounts',null,'agreed','15%'),
    ('AdManage','Ad Management Software',null,'agreed','20%'),
    ('TryAtria','Ad Spy Software',null,'agreed','25%'),
    ('Disputifier','Chargeback Prevention',null,'agreed','20%'),
    ('Chargemont','Chargeback Prevention',null,'none',null),
    ('Zamp','Taxes',null,'none',null)
  ) as v(name, category, contact, status, rate) loop
    insert into referral_partners (name, category) values (r.name, r.category) returning id into pid;
    insert into referral_partner_terms (partner_id, contact_name, agreement_status, commission_rate) values (pid, r.contact, r.status, r.rate);
  end loop;
end $$;
