create table if not exists public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  achievement_key text not null,
  unlocked_at timestamptz not null default now(),
  metadata_json jsonb not null default '{}'::jsonb,
  constraint user_achievements_unique unique (user_id, achievement_key)
);

create index if not exists user_achievements_user_idx on public.user_achievements (user_id);
create index if not exists user_achievements_key_idx on public.user_achievements (achievement_key);
