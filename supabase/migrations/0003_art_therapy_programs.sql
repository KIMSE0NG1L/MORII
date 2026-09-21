-- Replace program templates with 8-session art therapy program structure

delete from public.program_templates;

insert into public.program_templates (id, title, subtitle, icon, keywords, sort_order, is_active)
values
  ('a1111111-1111-1111-1111-111111111111'::uuid, '미술치료 8주 여정', '자신을 만나고 표현하는 시간', '🎨', '{}', 0, true),
  ('a2222222-2222-2222-2222-222222222222'::uuid, '1회기: 나를 만나는 시간', '자유로운 그리기로 마음을 펼쳐봅니다', '🖌️', '{}', 1, true),
  ('a3333333-3333-3333-3333-333333333333'::uuid, '2회기: 자유, 나의 마음', '색채로 감정을 표현해봅니다', '🎨', '{}', 2, true),
  ('a4444444-4444-4444-4444-444444444444'::uuid, '3회기: 나를 안아볼', '만다라를 색칠하며 마음을 정리합니다', '🌀', '{}', 3, true),
  ('a5555555-5555-5555-5555-555555555555'::uuid, '4회기: 감정의 색', '색상으로 감정 여정을 만들어봅니다', '🎭', '{}', 4, true),
  ('a6666666-6666-6666-6666-666666666666'::uuid, '5회기: 나의 이야기', '이미지 콜라주로 내 이야기를 표현합니다', '📰', '{}', 5, true),
  ('a7777777-7777-7777-7777-777777777777'::uuid, '6회기: 함께하는 마음', '타인의 작품을 감상하며 공감합니다', '🤝', '{}', 6, true),
  ('a8888888-8888-8888-8888-888888888888'::uuid, '7회기: 미래의 나', '명화와 함께 미래를 그려봅니다', '✨', '{}', 7, true),
  ('a9999999-9999-9999-9999-999999999999'::uuid, '8회기: 우리의 정원', '8주간의 여정을 돌아봅니다', '🌳', '{}', 8, true);

-- Create groups table for art therapy group sessions
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  facilitator_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text not null default '',
  status text not null default 'active' check (status in ('active', 'ended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.groups enable row level security;

create policy "groups are readable by members"
  on public.groups for select
  using (
    id in (
      select group_id from public.group_members where user_id = auth.uid()
    )
    or facilitator_id = auth.uid()
  );

create policy "groups are created/updated by facilitator"
  on public.groups for all
  using (facilitator_id = auth.uid())
  with check (facilitator_id = auth.uid());

-- Create group members table
create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  unique (group_id, user_id)
);

alter table public.group_members enable row level security;

create policy "group members can view their own memberships"
  on public.group_members for select
  using (
    user_id = auth.uid()
    or group_id in (
      select id from public.groups where facilitator_id = auth.uid()
    )
  );

create policy "group members can manage their own status"
  on public.group_members for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "facilitator can manage members"
  on public.group_members for all
  using (
    group_id in (
      select id from public.groups where facilitator_id = auth.uid()
    )
  )
  with check (
    group_id in (
      select id from public.groups where facilitator_id = auth.uid()
    )
  );
