-- Exhibition "공감" (likes) + one-line guestbook comments on exhibited
-- artworks, and free-form tags on diary records.

-- ---------------------------------------------------------------------------
-- Helper: can the current user see this exhibited entry? (same group)
-- ---------------------------------------------------------------------------
create or replace function public.can_view_exhibit(eid uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.diary_entries d
    where d.id = eid
      and d.exhibit_group_id is not null
      and (public.is_group_member(d.exhibit_group_id) or public.is_admin())
  );
$$;

-- ---------------------------------------------------------------------------
-- Likes
-- ---------------------------------------------------------------------------
create table if not exists public.artwork_likes (
  entry_id uuid not null references public.diary_entries (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (entry_id, user_id)
);

alter table public.artwork_likes enable row level security;

drop policy if exists "likes visible to exhibit viewers" on public.artwork_likes;
create policy "likes visible to exhibit viewers"
  on public.artwork_likes for select
  using (public.can_view_exhibit(entry_id));

drop policy if exists "viewers like as themselves" on public.artwork_likes;
create policy "viewers like as themselves"
  on public.artwork_likes for insert
  with check (user_id = auth.uid() and public.can_view_exhibit(entry_id));

drop policy if exists "likers can unlike" on public.artwork_likes;
create policy "likers can unlike"
  on public.artwork_likes for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Guestbook comments
-- ---------------------------------------------------------------------------
create table if not exists public.artwork_comments (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.diary_entries (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 200),
  created_at timestamptz not null default now()
);

create index if not exists artwork_comments_entry_idx
  on public.artwork_comments (entry_id, created_at);

alter table public.artwork_comments enable row level security;

drop policy if exists "comments visible to exhibit viewers" on public.artwork_comments;
create policy "comments visible to exhibit viewers"
  on public.artwork_comments for select
  using (public.can_view_exhibit(entry_id));

drop policy if exists "viewers comment as themselves" on public.artwork_comments;
create policy "viewers comment as themselves"
  on public.artwork_comments for insert
  with check (user_id = auth.uid() and public.can_view_exhibit(entry_id));

-- Authors delete their own; the artwork's owner and admins can tidy too.
drop policy if exists "comments deletable by author, artwork owner or admin" on public.artwork_comments;
create policy "comments deletable by author, artwork owner or admin"
  on public.artwork_comments for delete
  using (
    user_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.diary_entries d where d.id = entry_id and d.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Tags on records
-- ---------------------------------------------------------------------------
alter table public.diary_entries
  add column if not exists tags text[] not null default '{}';
