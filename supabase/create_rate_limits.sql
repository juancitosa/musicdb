create table if not exists rate_limits (
  key text primary key,
  scope varchar not null,
  count integer not null default 0,
  window_started_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists rate_limits_expires_at_idx
on rate_limits(expires_at);

alter table rate_limits enable row level security;

revoke all on table rate_limits from public, anon, authenticated;

create or replace function set_rate_limits_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists rate_limits_set_updated_at on rate_limits;

create trigger rate_limits_set_updated_at
before update on rate_limits
for each row
execute function set_rate_limits_updated_at();

create or replace function consume_rate_limit(
  p_key text,
  p_scope text,
  p_limit integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  current_count integer,
  retry_after_seconds integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_window_seconds integer := greatest(coalesce(p_window_seconds, 1), 1);
  v_window interval := make_interval(secs => v_window_seconds);
  v_limit integer := greatest(coalesce(p_limit, 1), 1);
  v_record rate_limits%rowtype;
begin
  if p_key is null or btrim(p_key) = '' then
    raise exception 'p_key is required';
  end if;

  if random() < 0.01 then
    delete from rate_limits
    where expires_at <= v_now;
  end if;

  insert into rate_limits as rl (
    key,
    scope,
    count,
    window_started_at,
    expires_at
  )
  values (
    p_key,
    coalesce(nullif(btrim(p_scope), ''), 'default'),
    1,
    v_now,
    v_now + v_window
  )
  on conflict (key) do update
  set
    scope = excluded.scope,
    count = case
      when rl.expires_at <= v_now then 1
      else rl.count + 1
    end,
    window_started_at = case
      when rl.expires_at <= v_now then v_now
      else rl.window_started_at
    end,
    expires_at = case
      when rl.expires_at <= v_now then v_now + v_window
      else rl.expires_at
    end,
    updated_at = v_now
  returning * into v_record;

  allowed := v_record.count <= v_limit;
  current_count := v_record.count;
  retry_after_seconds := case
    when allowed then 0
    else greatest(ceil(extract(epoch from (v_record.expires_at - v_now)))::integer, 1)
  end;
  reset_at := v_record.expires_at;

  return next;
end;
$$;

revoke all on function consume_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function consume_rate_limit(text, text, integer, integer) to service_role;
