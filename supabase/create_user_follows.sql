create table if not exists public.user_follows (
  id uuid primary key default gen_random_uuid(),
  follower_user_id uuid not null references public.users(id) on delete cascade,
  followed_user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint user_follows_unique unique (follower_user_id, followed_user_id),
  constraint user_follows_no_self_follow check (follower_user_id <> followed_user_id)
);

create index if not exists user_follows_follower_idx on public.user_follows (follower_user_id);
create index if not exists user_follows_followed_idx on public.user_follows (followed_user_id);
