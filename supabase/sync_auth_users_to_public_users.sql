create or replace function public.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_username text;
  next_display_name text;
begin
  next_username := nullif(trim(coalesce(new.raw_user_meta_data ->> 'username', '')), '');
  next_display_name := coalesce(next_username, split_part(new.email, '@', 1), 'MusicDB User');

  insert into public.users (
    id,
    email,
    username,
    display_name,
    auth_provider,
    is_verified,
    verified_at,
    created_at
  )
  values (
    new.id,
    new.email,
    next_username,
    next_display_name,
    'local',
    new.email_confirmed_at is not null,
    new.email_confirmed_at,
    coalesce(new.created_at, now())
  )
  on conflict (id) do update
  set
    email = excluded.email,
    username = coalesce(public.users.username, excluded.username),
    display_name = coalesce(public.users.display_name, excluded.display_name),
    auth_provider = coalesce(public.users.auth_provider, excluded.auth_provider),
    is_verified = coalesce(public.users.is_verified, excluded.is_verified),
    verified_at = coalesce(public.users.verified_at, excluded.verified_at);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_auth_user_created();
