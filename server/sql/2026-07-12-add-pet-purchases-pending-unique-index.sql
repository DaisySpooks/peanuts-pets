create unique index if not exists pet_purchases_pending_discord_user_id_key
  on public.pet_purchases (discord_user_id)
  where status = 'PENDING';
