-- handle_new_user() only ever checked raw_user_meta_data->>'nickname', but
-- Kakao/Google OAuth never set that key (they use name/full_name/
-- user_name/preferred_username instead) - every social sign-up silently
-- fell through to the "새로운 정원사" placeholder. Fix the trigger for
-- future sign-ups and backfill existing profiles from their real OAuth name.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, nickname)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'nickname',
      new.raw_user_meta_data ->> 'name',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'user_name',
      new.raw_user_meta_data ->> 'preferred_username',
      split_part(new.email, '@', 1),
      '새로운 정원사'
    )
  );
  return new;
end;
$$;

update public.profiles p
set nickname = coalesce(
  u.raw_user_meta_data ->> 'nickname',
  u.raw_user_meta_data ->> 'name',
  u.raw_user_meta_data ->> 'full_name',
  u.raw_user_meta_data ->> 'user_name',
  u.raw_user_meta_data ->> 'preferred_username',
  split_part(u.email, '@', 1),
  p.nickname
)
from auth.users u
where u.id = p.id;
