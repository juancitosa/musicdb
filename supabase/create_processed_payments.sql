create table if not exists processed_payments (
  id uuid primary key default gen_random_uuid(),
  payment_id varchar not null unique,
  user_id uuid,
  payment_status varchar not null default 'processing',
  purchased_months integer,
  pro_until timestamp with time zone,
  payload_json jsonb,
  error_code varchar,
  error_message text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index if not exists processed_payments_payment_status_idx
on processed_payments(payment_status);

create or replace function set_processed_payments_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists processed_payments_updated_at on processed_payments;

create trigger processed_payments_updated_at
before update on processed_payments
for each row
execute function set_processed_payments_updated_at();
