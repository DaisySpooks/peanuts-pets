alter table public.pets
  add column if not exists lifetime_affection integer not null default 0;

update public.pets
set lifetime_affection = coalesce(lifetime_affection, 0)
where lifetime_affection is null;
