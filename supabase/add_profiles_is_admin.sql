alter table profiles
add column if not exists is_admin boolean default false;

update profiles
set is_admin = false
where is_admin is null;
