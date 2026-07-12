alter table public.pets
  add column if not exists last_petted_at timestamptz;
