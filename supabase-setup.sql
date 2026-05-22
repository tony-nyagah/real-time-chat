-- Messages table
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  room text not null,
  user_id text not null,
  username text not null,
  content text not null,
  created_at timestamptz default now()
);

create index if not exists messages_room_created_idx on messages(room, created_at);

alter table messages enable row level security;

create policy "messages_select" on messages for select using (true);
create policy "messages_insert" on messages for insert with check (true);

-- RLS on realtime.messages for private channels
create policy "authenticated_users_can_receive" on realtime.messages
  for select to authenticated using (true);

create policy "authenticated_users_can_send" on realtime.messages
  for insert to authenticated with check (true);

-- Enable Postgres Changes realtime for this table
alter publication supabase_realtime add table messages;
