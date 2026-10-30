-- Group announcements + a generic (non-Zoom) link field per session, for
-- the "코드 쳐서 입장 -> 수업 파일 / 링크공유 / 공지사항" e-class request.

alter table public.program_sessions
  add column if not exists link_url text,
  add column if not exists link_label text;

create table if not exists public.group_notices (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  body text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists group_notices_group_idx
  on public.group_notices (group_id, created_at desc);

alter table public.group_notices enable row level security;

create policy "notices are readable by group members"
  on public.group_notices for select
  using (public.is_group_member(group_id));

create policy "notices are managed by facilitator"
  on public.group_notices for all
  using (public.is_group_facilitator(group_id))
  with check (public.is_group_facilitator(group_id) and author_id = auth.uid());
