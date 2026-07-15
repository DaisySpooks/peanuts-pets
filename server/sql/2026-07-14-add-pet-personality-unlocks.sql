create table if not exists public.pet_personality_unlocks (
  unlock_id uuid primary key default gen_random_uuid(),
  discord_user_id text not null,
  unlock_key text not null,
  temperament text not null,
  earned_at timestamptz not null default now()
);

create unique index if not exists pet_personality_unlocks_user_unlock_key
  on public.pet_personality_unlocks (discord_user_id, unlock_key);

create index if not exists pet_personality_unlocks_discord_user_id_idx
  on public.pet_personality_unlocks (discord_user_id);

alter table public.pet_personality_unlocks enable row level security;
