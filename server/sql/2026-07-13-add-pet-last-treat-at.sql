alter table public.pets
  add column if not exists last_treat_at timestamptz;
