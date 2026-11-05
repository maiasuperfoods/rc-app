-- Knowledge Base (Renaissance Commerce course). Applied 6 Nov 2026 to the shared project
-- as migrations kb_knowledge_base + kb_media_and_access. Content imported from the old
-- Lovable course (5 categories, 20 chapters, 99 lessons); media copied to bucket kb-media.

create table if not exists public.kb_categories (
  id uuid primary key, title text not null, description text default '', icon text,
  image_url text, image_path text, "order" int not null default 0,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists public.kb_chapters (
  id uuid primary key, category_id uuid not null references public.kb_categories(id) on delete cascade,
  title text not null, icon text, "order" int not null default 0,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists public.kb_lessons (
  id uuid primary key, chapter_id uuid not null references public.kb_chapters(id) on delete cascade,
  title text not null, content text default '', video_url text, video_path text, "order" int not null default 0,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists public.kb_lesson_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.kb_lessons(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
create index if not exists kb_chapters_category_order on public.kb_chapters(category_id, "order");
create index if not exists kb_lessons_chapter_order on public.kb_lessons(chapter_id, "order");

alter table public.kb_categories enable row level security;
alter table public.kb_chapters enable row level security;
alter table public.kb_lessons enable row level security;
alter table public.kb_lesson_progress enable row level security;
create policy kb_categories_read on public.kb_categories for select to authenticated using (true);
create policy kb_chapters_read on public.kb_chapters for select to authenticated using (true);
create policy kb_lessons_read on public.kb_lessons for select to authenticated using (true);
create policy kb_progress_own_read on public.kb_lesson_progress for select to authenticated using (user_id = auth.uid());
create policy kb_progress_own_insert on public.kb_lesson_progress for insert to authenticated with check (user_id = auth.uid());
create policy kb_progress_own_delete on public.kb_lesson_progress for delete to authenticated using (user_id = auth.uid());

-- Private media bucket; signed URLs are issued per request.
insert into storage.buckets (id, name, public) values ('kb-media', 'kb-media', false) on conflict (id) do nothing;
create policy kb_media_read on storage.objects for select to authenticated using (bucket_id = 'kb-media');

-- Server-to-server token (sha256 only) for the `kb` edge function used by the demo deployment.
create table if not exists public.kb_access_tokens (token_sha256 text primary key, label text not null, created_at timestamptz default now());
alter table public.kb_access_tokens enable row level security;
