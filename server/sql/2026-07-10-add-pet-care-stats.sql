alter table public.pets
  add column if not exists hunger integer not null default 78,
  add column if not exists cleanliness integer not null default 86,
  add column if not exists happiness integer not null default 92,
  add column if not exists last_feed_at timestamptz,
  add column if not exists last_clean_at timestamptz,
  add column if not exists last_play_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.pets
  add constraint pets_hunger_range check (hunger between 0 and 100),
  add constraint pets_cleanliness_range check (cleanliness between 0 and 100),
  add constraint pets_happiness_range check (happiness between 0 and 100);

update public.pets
set
  hunger = coalesce(hunger, 78),
  cleanliness = coalesce(cleanliness, 86),
  happiness = coalesce(happiness, 92),
  updated_at = coalesce(updated_at, created_at, now());
