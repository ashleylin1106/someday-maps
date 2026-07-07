-- Someday Maps — cloud sync table.
-- Run this ONCE in Supabase: your project → SQL Editor → paste → Run.

create table if not exists public.lists (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.lists enable row level security;

-- Each user can only read/write their own row.
create policy "own rows" on public.lists
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
