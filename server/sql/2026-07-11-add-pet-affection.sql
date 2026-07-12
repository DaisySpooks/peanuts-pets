alter table public.pets
  add column if not exists affection integer not null default 0;

update public.pets
set affection = coalesce(affection, 0)
where affection is null;
