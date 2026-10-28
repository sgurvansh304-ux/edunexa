-- EduNexa starter database for Supabase (PostgreSQL).
-- Run in Supabase SQL Editor. Review before using in production.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'student' check (role in ('student','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 180),
  category text not null check (category in ('Class 1–12','JEE','NEET')),
  level text not null check (char_length(level) between 1 and 40),
  subject text not null check (char_length(subject) between 1 and 80),
  topic text not null check (char_length(topic) between 1 and 120),
  resource_type text not null check (resource_type in ('Worksheet','PYQ','Mock test','Practice paper','Important questions')),
  content text not null,
  answer text,
  published boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.test_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  resource_id uuid references public.resources(id) on delete set null,
  score numeric,
  total numeric,
  answers jsonb not null default '{}'::jsonb,
  completed_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.resources enable row level security;
alter table public.test_attempts enable row level security;

-- New users get a student profile. Users cannot choose their own role.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, role) values (new.id, 'student')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;

grant execute on function public.is_admin() to authenticated;
grant select, insert, update, delete on public.resources to authenticated;
grant select on public.profiles to authenticated;
grant select, insert on public.test_attempts to authenticated;
grant select, update on public.test_attempts to authenticated;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile" on public.profiles
for select to authenticated using (id = (select auth.uid()) or public.is_admin());

drop policy if exists "Anyone can read published resources" on public.resources;
create policy "Anyone can read published resources" on public.resources
for select to anon, authenticated using (published = true or public.is_admin());

drop policy if exists "Admins can insert resources" on public.resources;
create policy "Admins can insert resources" on public.resources
for insert to authenticated with check (public.is_admin() and created_by is null or public.is_admin());

drop policy if exists "Admins can update resources" on public.resources;
create policy "Admins can update resources" on public.resources
for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins can delete resources" on public.resources;
create policy "Admins can delete resources" on public.resources
for delete to authenticated using (public.is_admin());

drop policy if exists "Users read own attempts" on public.test_attempts;
create policy "Users read own attempts" on public.test_attempts
for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists "Users insert own attempts" on public.test_attempts;
create policy "Users insert own attempts" on public.test_attempts
for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "Users update own attempts" on public.test_attempts;
create policy "Users update own attempts" on public.test_attempts
for update to authenticated using (user_id = (select auth.uid()) or public.is_admin())
with check (user_id = (select auth.uid()) or public.is_admin());

-- IMPORTANT: Promote a trusted account manually after it has signed up and verified email:
-- update public.profiles set role = 'admin'
-- where id = (select id from auth.users where email = 'YOUR_VERIFIED_ADMIN_EMAIL');
-- Run the above as the project owner in SQL Editor only. Never expose service-role keys.
