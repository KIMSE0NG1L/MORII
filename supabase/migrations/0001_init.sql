-- MORII initial schema: profiles, mind garden, diary, programs, community.
-- Run in the Supabase SQL editor, or via `supabase db push` once the CLI is linked.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null default '새로운 정원사',
  bio text not null default '',
  avatar_id text not null default 'a1',
  visibility text not null default 'public' check (visibility in ('public', 'friends', 'private')),
  xp int not null default 0 check (xp between 0 and 100),
  quest_done boolean not null default false,
  garden_theme text not null default 'forest' check (garden_theme in ('forest', 'night', 'sea')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are readable by owner or when public"
  on public.profiles for select
  using (visibility = 'public' or id = auth.uid());

create policy "profiles are editable by owner"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, nickname)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nickname', '새로운 정원사'));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Clamp XP 0..100 and touch updated_at from any function that adjusts XP.
create or replace function public.add_xp(p_user_id uuid, p_amount int)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.profiles
  set xp = greatest(0, least(100, xp + p_amount)),
      updated_at = now()
  where id = p_user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- garden_items - user-placed decorations beyond the automatic stage unlocks
-- ---------------------------------------------------------------------------
create table if not exists public.garden_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  item_key text not null,
  emoji text not null,
  left_pct numeric not null default 0.5,
  top_pct numeric not null default 0.5,
  font_size numeric not null default 40,
  created_at timestamptz not null default now(),
  unique (user_id, item_key)
);

alter table public.garden_items enable row level security;

create policy "garden items are managed by owner"
  on public.garden_items for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- diary_entries
-- ---------------------------------------------------------------------------
create table if not exists public.diary_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_type text not null default 'text' check (entry_type in ('text', 'drawing', 'voice')),
  content text not null default '',
  mood smallint check (mood between 0 and 4),
  created_at timestamptz not null default now()
);

alter table public.diary_entries enable row level security;

create policy "diary entries are managed by owner"
  on public.diary_entries for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- programs (shared catalog + per-user enrollment/progress)
-- ---------------------------------------------------------------------------
create table if not exists public.program_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text not null default '',
  icon text not null default '🌿',
  keywords text[] not null default '{}',
  sort_order int not null default 0,
  is_active boolean not null default true
);

alter table public.program_templates enable row level security;

create policy "program templates are readable by anyone signed in"
  on public.program_templates for select
  to authenticated
  using (is_active);

create table if not exists public.program_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  program_id uuid not null references public.program_templates (id) on delete cascade,
  status text not null default 'ongoing' check (status in ('ongoing', 'completed')),
  progress numeric not null default 0 check (progress between 0 and 1),
  updated_at timestamptz not null default now(),
  unique (user_id, program_id)
);

alter table public.program_enrollments enable row level security;

create policy "program enrollments are managed by owner"
  on public.program_enrollments for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

insert into public.program_templates (title, subtitle, icon, keywords, sort_order)
values
  ('나를 다시 돌보는 4주', '감정 알아차리기 → 표현하기 → 변화시키기 → 돌아보기', '🌿', '{}', 0),
  ('나의 마음 쉼터 만들기', '안전하고 편안하게 느껴지는 공간을 그려봅니다', '🏡', array['외로', '혼자'], 1),
  ('감정에 이름 붙이기', '흐릿한 감정에 이름을 붙여 명확하게 바라봅니다', '🏷️', '{}', 2),
  ('나에게 쓰는 편지', '미래의 나에게 위로의 편지를 씁니다', '✉️', array['지치', '힘들', '피곤'], 3),
  ('내 마음의 날씨', '감정을 날씨에 빗대어 표현해봅니다', '🌦️', array['불안', '긴장'], 4)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- community: posts, likes, comments, mind cards
-- ---------------------------------------------------------------------------
create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text not null default '',
  emoji text not null default '🌊',
  gradient_start text not null default '#D4E1E5',
  gradient_end text not null default '#E7D8C9',
  like_count int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.community_posts enable row level security;

create policy "community posts are readable by anyone signed in"
  on public.community_posts for select
  to authenticated
  using (true);

create policy "community posts are managed by owner"
  on public.community_posts for insert
  with check (user_id = auth.uid());

create policy "community posts are updatable by owner"
  on public.community_posts for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "community posts are deletable by owner"
  on public.community_posts for delete
  using (user_id = auth.uid());

create table if not exists public.post_likes (
  post_id uuid not null references public.community_posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.post_likes enable row level security;

create policy "post likes are readable by anyone signed in"
  on public.post_likes for select
  to authenticated
  using (true);

create policy "post likes are managed by the liker"
  on public.post_likes for insert
  with check (user_id = auth.uid());

create policy "post likes are removable by the liker"
  on public.post_likes for delete
  using (user_id = auth.uid());

create or replace function public.handle_post_like_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.community_posts set like_count = like_count + 1 where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.community_posts set like_count = greatest(0, like_count - 1) where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists on_post_like_change on public.post_likes;
create trigger on_post_like_change
  after insert or delete on public.post_likes
  for each row execute function public.handle_post_like_change();

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

alter table public.post_comments enable row level security;

create policy "post comments are readable by anyone signed in"
  on public.post_comments for select
  to authenticated
  using (true);

create policy "post comments are insertable by the author"
  on public.post_comments for insert
  with check (user_id = auth.uid());

create policy "post comments are deletable by the author"
  on public.post_comments for delete
  using (user_id = auth.uid());

create table if not exists public.mind_cards (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.mind_cards enable row level security;

create policy "mind cards are readable by sender or post owner"
  on public.mind_cards for select
  using (
    sender_id = auth.uid()
    or exists (
      select 1 from public.community_posts p
      where p.id = mind_cards.post_id and p.user_id = auth.uid()
    )
  );

create policy "mind cards are sendable by anyone signed in"
  on public.mind_cards for insert
  with check (sender_id = auth.uid());
