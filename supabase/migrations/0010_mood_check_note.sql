-- Optional free-text note alongside the 1-10 slider answers, so a mood
-- check can say more than five numbers - also fed to recommendMandala()
-- for a richer AI match than the sliders alone give it.
alter table public.mood_checks
  add column if not exists note text not null default '';
