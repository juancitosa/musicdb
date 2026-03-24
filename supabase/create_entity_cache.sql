create table if not exists entity_cache (
  id uuid primary key default gen_random_uuid(),
  entity_type varchar not null,
  entity_id varchar not null,
  source varchar default 'spotify',
  payload_json jsonb,
  image_url text,
  name varchar,
  subtitle varchar,
  popularity integer,
  release_date varchar,
  updated_at timestamp with time zone default now()
);

create unique index if not exists entity_cache_entity_type_entity_id_idx
on entity_cache(entity_type, entity_id);

create index if not exists entity_cache_updated_at_idx
on entity_cache(updated_at desc);
