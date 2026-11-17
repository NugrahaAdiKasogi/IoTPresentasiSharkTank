-- =====================================================================
--  IoT SHARK TANK: BATTLE OF INNOVATORS — Skema Database Supabase
--  Jalankan seluruh skrip ini SEKALI di Supabase > SQL Editor > Run.
--  Aman dijalankan ulang (idempotent) untuk tabel, fungsi, dan policy.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. TABEL GROUPS (kelompok siswa + dompet bersama)
-- ---------------------------------------------------------------------
create table if not exists public.groups (
  id               uuid primary key default gen_random_uuid(),
  class_name       text   not null,
  group_name       text   not null,
  project_title    text   not null,
  pin              text   not null,
  initial_budget   bigint not null default 100000000,
  questions_asked  int    not null default 0,
  created_at       timestamptz default now(),
  constraint groups_pin_4_digit       check (pin ~ '^[0-9]{4}$'),
  constraint groups_questions_nonneg  check (questions_asked >= 0),
  constraint groups_budget_nonneg     check (initial_budget >= 0),
  constraint groups_unique_name_class unique (class_name, group_name)
);

create index if not exists groups_class_idx on public.groups (class_name);

-- ---------------------------------------------------------------------
-- 2. TABEL INVESTMENTS (1 keputusan per pasangan investor -> target)
-- ---------------------------------------------------------------------
create table if not exists public.investments (
  id                 uuid primary key default gen_random_uuid(),
  class_name         text   not null,
  investor_group_id  uuid   not null references public.groups(id) on delete cascade,
  target_group_id    uuid   not null references public.groups(id) on delete cascade,
  amount             bigint not null check (amount >= 0 and amount <= 25000000),
  feedback           text   not null,
  created_at         timestamptz default now(),
  constraint investments_unique_pair  unique (investor_group_id, target_group_id),
  constraint investments_not_self     check (investor_group_id <> target_group_id),
  constraint investments_feedback_min check (char_length(btrim(feedback)) >= 20)
);

create index if not exists investments_class_idx  on public.investments (class_name);
create index if not exists investments_target_idx on public.investments (target_group_id);

-- ---------------------------------------------------------------------
-- 3. TABEL STAGE_STATE (Single Source of Truth — hanya 1 baris id = 1)
-- ---------------------------------------------------------------------
create table if not exists public.stage_state (
  id                     int primary key default 1 check (id = 1),
  active_class           text not null default '9A',
  active_group_id        uuid references public.groups(id) on delete set null,
  phase                  text not null default 'IDLE'
                         check (phase in ('IDLE', 'PITCH', 'QA', 'INVEST')),
  timer_end_at           timestamptz,
  paused_seconds_left    int check (paused_seconds_left is null or paused_seconds_left >= 0),
  is_leaderboard_frozen  boolean not null default false,
  updated_at             timestamptz default now()
);

insert into public.stage_state (id, active_class, phase, is_leaderboard_frozen)
values (1, '9A', 'IDLE', false)
on conflict (id) do nothing;

-- updated_at otomatis setiap ada perubahan stage
create or replace function public.touch_stage_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_stage_updated_at on public.stage_state;
create trigger trg_stage_updated_at
before update on public.stage_state
for each row execute function public.touch_stage_updated_at();

-- ---------------------------------------------------------------------
-- 4. PENGAMAN ANTI-BUG DI LEVEL DATABASE (trigger investasi)
--    - Kunci baris dompet investor (FOR UPDATE) -> mencegah race condition
--      saat beberapa laptop satu kelompok menekan kirim bersamaan.
--    - Tolak jika saldo tidak cukup, fase bukan INVEST, target bukan
--      presenter aktif, waktu habis, atau beda kelas.
--    - class_name diisi otomatis dari kelompok investor.
-- ---------------------------------------------------------------------
create or replace function public.validate_investment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_investor public.groups%rowtype;
  v_target   public.groups%rowtype;
  v_stage    public.stage_state%rowtype;
  v_spent    bigint;
begin
  select * into v_investor from public.groups where id = new.investor_group_id for update;
  if not found then
    raise exception 'INVESTOR_NOT_FOUND' using errcode = 'P0001';
  end if;

  select * into v_target from public.groups where id = new.target_group_id;
  if not found then
    raise exception 'TARGET_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_investor.class_name <> v_target.class_name then
    raise exception 'CLASS_MISMATCH' using errcode = 'P0001';
  end if;

  select * into v_stage from public.stage_state where id = 1;
  if v_stage.phase <> 'INVEST'
     or v_stage.active_group_id is distinct from new.target_group_id
     or v_stage.active_class <> v_investor.class_name then
    raise exception 'INVEST_CLOSED' using errcode = 'P0001';
  end if;

  -- toleransi 5 detik untuk jeda jaringan
  if v_stage.timer_end_at is not null and now() > v_stage.timer_end_at + interval '5 seconds' then
    raise exception 'INVEST_TIME_UP' using errcode = 'P0001';
  end if;
  if v_stage.timer_end_at is null and coalesce(v_stage.paused_seconds_left, 0) <= 0 then
    raise exception 'INVEST_TIME_UP' using errcode = 'P0001';
  end if;

  select coalesce(sum(amount), 0) into v_spent
  from public.investments where investor_group_id = new.investor_group_id;

  if v_spent + new.amount > v_investor.initial_budget then
    raise exception 'BUDGET_EXCEEDED' using errcode = 'P0001';
  end if;

  new.class_name := v_investor.class_name;
  new.feedback   := btrim(new.feedback);
  return new;
end;
$$;

drop trigger if exists trg_validate_investment on public.investments;
create trigger trg_validate_investment
before insert on public.investments
for each row execute function public.validate_investment();

-- ---------------------------------------------------------------------
-- 5. FUNGSI RPC
-- ---------------------------------------------------------------------
-- Jam server: dipakai klien untuk mengoreksi selisih jam laptop (clock skew)
create or replace function public.server_now()
returns timestamptz language sql stable as $$ select now(); $$;

-- +1 / -1 pertanyaan secara atomik (tidak pernah di bawah 0)
create or replace function public.adjust_questions(p_group_id uuid, p_delta int)
returns int language sql as $$
  update public.groups
     set questions_asked = greatest(0, questions_asked + p_delta)
   where id = p_group_id
  returning questions_asked;
$$;

-- ---------------------------------------------------------------------
-- 6. REALTIME
-- ---------------------------------------------------------------------
alter table public.groups      replica identity full;
alter table public.investments replica identity full;
alter table public.stage_state replica identity full;

-- Setara dengan: ALTER PUBLICATION supabase_realtime ADD TABLE groups, investments, stage_state;
-- dibungkus agar tidak error jika skrip dijalankan ulang.
do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array['groups', 'investments', 'stage_state'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 7. RLS PERMISIF (tanpa login email; cocok untuk lab kelas)
-- ---------------------------------------------------------------------
alter table public.groups      enable row level security;
alter table public.investments enable row level security;
alter table public.stage_state enable row level security;

drop policy if exists "open_all_groups"      on public.groups;
drop policy if exists "open_all_investments" on public.investments;
drop policy if exists "open_all_stage"       on public.stage_state;

create policy "open_all_groups"      on public.groups      for all using (true) with check (true);
create policy "open_all_investments" on public.investments for all using (true) with check (true);
create policy "open_all_stage"       on public.stage_state for all using (true) with check (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.groups, public.investments, public.stage_state to anon, authenticated;
grant execute on function public.server_now()                to anon, authenticated;
grant execute on function public.adjust_questions(uuid, int) to anon, authenticated;

-- Selesai. Lanjutkan dengan seed_contoh.sql (opsional) untuk data uji coba.
