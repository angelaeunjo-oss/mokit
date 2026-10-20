-- Mokit anonymous message board setup
-- Run this entire file in Supabase Dashboard > SQL Editor.

create table if not exists public.mokit_profile (
  id integer primary key default 1 check (id = 1),
  nickname text not null default '모킷',
  avatar_url text not null default '',
  cover_url text not null default '',
  bio text not null default '익명으로 마음을 놓고 가는 곳',
  updated_at timestamptz not null default now()
);

insert into public.mokit_profile (id)
values (1)
on conflict (id) do nothing;

create table if not exists public.mokit_messages (
  id bigint generated always as identity primary key,
  body text not null check (char_length(body) between 1 and 500),
  reply text not null default '',
  created_at timestamptz not null default now()
);

alter table public.mokit_profile enable row level security;
alter table public.mokit_messages add column if not exists reply text not null default '';
alter table public.mokit_messages enable row level security;

drop policy if exists "Anyone can read profile" on public.mokit_profile;
create policy "Anyone can read profile"
on public.mokit_profile for select
to anon, authenticated
using (true);

drop policy if exists "Admins can update profile" on public.mokit_profile;
create policy "Admins can update profile"
on public.mokit_profile for update
to authenticated
using ((auth.jwt() ->> 'email') = 'admin@mokit.local')
with check ((auth.jwt() ->> 'email') = 'admin@mokit.local');

drop policy if exists "Anyone can read messages" on public.mokit_messages;
create policy "Anyone can read messages"
on public.mokit_messages for select
to anon, authenticated
using (true);

drop policy if exists "Anyone can send anonymous messages" on public.mokit_messages;
create policy "Anyone can send anonymous messages"
on public.mokit_messages for insert
to anon, authenticated
with check (char_length(body) between 1 and 500);

drop policy if exists "Admins can reply to messages" on public.mokit_messages;
create policy "Admins can reply to messages"
on public.mokit_messages for update
to authenticated
using ((auth.jwt() ->> 'email') = 'admin@mokit.local')
with check ((auth.jwt() ->> 'email') = 'admin@mokit.local');

-- Enable realtime updates for new messages/profile changes.
do $$
begin
  alter publication supabase_realtime add table public.mokit_messages;
exception when duplicate_object then null;
when others then
  if sqlstate != '42710' then raise; end if;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.mokit_profile;
exception when duplicate_object then null;
when others then
  if sqlstate != '42710' then raise; end if;
end $$;

-- Admin-only message deletion. Run this if the setup SQL was already run.
drop policy if exists "Admins can delete messages" on public.mokit_messages;
create policy "Admins can delete messages"
on public.mokit_messages for delete
to authenticated
using ((auth.jwt() ->> 'email') = 'admin@mokit.local');
