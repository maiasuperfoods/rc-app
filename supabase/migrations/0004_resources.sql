-- Knowledge Base → Resources (Pre-Sales Vault + Post-Purchase Vault). Applied 6 Nov 2026 as migration res_vaults.
-- Imported from pre-sales-vault.lovable.app (29 breakdowns, 15 screenshots) and postpurchase-peek.lovable.app
-- (11 dossiers, 22 upsells, 47 media). Media in private bucket res-media; app access via the `resources` edge function.
create table if not exists public.res_presale_brands (
  id uuid primary key default gen_random_uuid(), slug text not null unique, brand_name text not null,
  product_name text not null default '', niche text not null default '',
  style text not null default 'Personal Story' check (style in ('Personal Story','Exposé','Listicle','Hybrid')),
  hybrid_blend text, live_url text not null default '', headline text not null default '', description text not null default '',
  target_avatar text not null default '', core_price text not null default 'N/A', format text not null default 'Text + Images',
  traffic_flow text not null default 'Ad → Advertorial → Sales Page → Checkout',
  section_breakdown jsonb not null default '{}'::jsonb, deep_copywriting_breakdown jsonb not null default '{}'::jsonb,
  source_url text not null default '', status text not null default 'draft' check (status in ('draft','published')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.res_presale_screenshots (
  id uuid primary key default gen_random_uuid(), brand_id uuid not null references public.res_presale_brands(id) on delete cascade,
  path text, external_url text, sort_order int not null default 0, created_at timestamptz not null default now()
);
create table if not exists public.res_ppu_brands (
  id text primary key, brand_name text not null, core_product text not null default '', niche text not null default '',
  presenter text not null default '', script_style text not null default '', brand_context jsonb not null default '{}'::jsonb,
  sort_order int not null default 0, status text not null default 'published' check (status in ('draft','published')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.res_ppu_upsells (
  brand_id text not null references public.res_ppu_brands(id) on delete cascade, step int not null,
  title text not null default '', type text not null default '', key_tactics jsonb not null default '[]'::jsonb,
  script text not null default '', offer_structure jsonb not null default '{}'::jsonb, psych_breakdown jsonb not null default '{}'::jsonb,
  is_text_only boolean not null default false, primary key (brand_id, step)
);
create table if not exists public.res_ppu_media (
  id uuid primary key default gen_random_uuid(), brand_id text not null references public.res_ppu_brands(id) on delete cascade,
  step int not null, media_type text not null check (media_type in ('video','screenshot')),
  path text, external_url text, sort_order int not null default 0, created_at timestamptz not null default now()
);
alter table public.res_presale_brands enable row level security;
alter table public.res_presale_screenshots enable row level security;
alter table public.res_ppu_brands enable row level security;
alter table public.res_ppu_upsells enable row level security;
alter table public.res_ppu_media enable row level security;
create policy res_presale_read on public.res_presale_brands for select to authenticated using (status = 'published');
create policy res_presale_shots_read on public.res_presale_screenshots for select to authenticated using (true);
create policy res_ppu_read on public.res_ppu_brands for select to authenticated using (status = 'published');
create policy res_ppu_upsells_read on public.res_ppu_upsells for select to authenticated using (true);
create policy res_ppu_media_read on public.res_ppu_media for select to authenticated using (true);
insert into storage.buckets (id, name, public) values ('res-media','res-media', false) on conflict (id) do nothing;
create policy res_media_read on storage.objects for select to authenticated using (bucket_id = 'res-media');
