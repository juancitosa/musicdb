create extension if not exists pgcrypto;

create table if not exists review_likes (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references reviews(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists review_likes_review_user_unique_idx
on review_likes(review_id, user_id);

create index if not exists review_likes_review_id_idx
on review_likes(review_id);

create index if not exists review_likes_user_id_idx
on review_likes(user_id);

create table if not exists review_replies (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references reviews(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  reply_text text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists review_replies_review_id_idx
on review_replies(review_id);

create index if not exists review_replies_user_id_idx
on review_replies(user_id);

create or replace function set_review_replies_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists review_replies_set_updated_at on review_replies;

create trigger review_replies_set_updated_at
before update on review_replies
for each row
execute function set_review_replies_updated_at();
