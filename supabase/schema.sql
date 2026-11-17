-- =====================================================================
--  KPI TIZIMI — Supabase sxemasi
--  Supabase Dashboard → SQL Editor → shu faylni to'liq joylab, "Run".
--  Qayta ishga tushirish xavfsiz (idempotent): mavjud ma'lumot o'chmaydi.
-- =====================================================================

-- ---------- Kengaytmalar (Telegram xabarlari va jadval bo'yicha ishlar) ----------
do $$ begin
  create extension if not exists pg_net with schema extensions;
exception when others then
  raise notice 'pg_net yoqilmadi (Telegram uchun kerak): %', sqlerrm;
end $$;

-- =====================================================================
--  JADVALLAR
-- =====================================================================

create table if not exists public.companies (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  join_code             text not null unique,
  timezone              text not null default 'Asia/Tashkent',
  default_lang          text not null default 'uz' check (default_lang in ('uz','ru','en')),
  currency              text not null default 'UZS',
  -- Ishxona joylashuvi
  office_lat            double precision,
  office_lng            double precision,
  radius_m              int  not null default 100 check (radius_m between 10 and 5000),
  require_selfie        boolean not null default true,
  -- Umumiy ish jadvali
  work_start            time not null default '09:00',
  work_end              time not null default '18:00',
  grace_minutes         int  not null default 10 check (grace_minutes between 0 and 240),
  break_start           time default '13:00',
  break_end             time default '14:00',
  work_days             int[] not null default '{1,2,3,4,5}',   -- ISO: 1=Du ... 7=Ya
  -- Jarimalar
  late_fine_per_case    numeric not null default 0 check (late_fine_per_case >= 0),
  late_fine_per_minute  numeric not null default 0 check (late_fine_per_minute >= 0),
  early_fine_per_minute numeric not null default 0 check (early_fine_per_minute >= 0),
  deduct_absent_days    boolean not null default true,
  -- KPI va oylik
  kpi_salary_share      int not null default 30 check (kpi_salary_share between 0 and 100),
  w_attendance          int not null default 40 check (w_attendance between 0 and 100),
  w_tasks               int not null default 30 check (w_tasks between 0 and 100),
  w_rating              int not null default 30 check (w_rating between 0 and 100),
  late_day_credit       numeric not null default 0.5 check (late_day_credit between 0 and 1),
  created_at            timestamptz not null default now(),
  constraint weights_sum_100 check (w_attendance + w_tasks + w_rating = 100)
);

-- Telegram sozlamalari alohida jadvalda: token faqat adminga ko'rinadi
create table if not exists public.company_telegram (
  company_id        uuid primary key references public.companies(id) on delete cascade,
  bot_token         text,
  chat_id           text,
  enabled           boolean not null default false,
  notify_late       boolean not null default true,
  notify_checkin    boolean not null default false,
  notify_checkout   boolean not null default false,
  daily_summary     boolean not null default true,
  summary_time      time not null default '10:00',
  last_summary_date date
);

create table if not exists public.members (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  user_id         uuid not null unique references auth.users(id) on delete cascade,
  full_name       text not null,
  email           text,
  phone           text,
  position        text,
  role            text not null default 'employee' check (role in ('admin','employee')),
  status          text not null default 'pending' check (status in ('pending','active','inactive')),
  base_salary     numeric not null default 0 check (base_salary >= 0),
  start_date      date not null default current_date,
  track_attendance boolean not null default true,   -- davomat va KPI hisobotlarida qatnashadimi
  -- Shaxsiy jadval (custom_schedule = true bo'lsa, bo'sh maydonlar umumiy jadvaldan olinadi)
  custom_schedule boolean not null default false,
  work_start      time,
  work_end        time,
  grace_minutes   int check (grace_minutes between 0 and 240),
  break_start     time,
  break_end       time,
  work_days       int[],
  created_at      timestamptz not null default now()
);
create index if not exists members_company_idx on public.members(company_id);

create table if not exists public.attendance (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references public.companies(id) on delete cascade,
  member_id           uuid not null references public.members(id) on delete cascade,
  work_date           date not null,
  status              text not null default 'present' check (status in ('present','late','excused','absent')),
  check_in_at         timestamptz,
  check_in_lat        double precision,
  check_in_lng        double precision,
  check_in_accuracy   double precision,
  check_in_distance   int,
  check_in_selfie     text,
  check_out_at        timestamptz,
  check_out_lat       double precision,
  check_out_lng       double precision,
  check_out_accuracy  double precision,
  check_out_distance  int,
  late_minutes        int not null default 0,
  early_leave_minutes int not null default 0,
  worked_minutes      int,
  note                text,
  edited_by           uuid references public.members(id) on delete set null,
  edited_at           timestamptz,
  created_at          timestamptz not null default now(),
  unique (member_id, work_date)
);
create index if not exists attendance_company_date_idx on public.attendance(company_id, work_date);

create table if not exists public.holidays (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  day        date not null,
  name       text,
  unique (company_id, day)
);

create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  assignee_id  uuid not null references public.members(id) on delete cascade,
  title        text not null,
  description  text,
  due_date     date not null,
  points       int not null default 1 check (points between 1 and 10),
  status       text not null default 'todo' check (status in ('todo','in_progress','done')),
  completed_at timestamptz,
  created_by   uuid references public.members(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists tasks_company_due_idx on public.tasks(company_id, due_date);

create table if not exists public.ratings (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  member_id  uuid not null references public.members(id) on delete cascade,
  period     date not null check (extract(day from period) = 1),
  score      int  not null check (score between 1 and 10),
  comment    text,
  rated_by   uuid references public.members(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (member_id, period)
);

-- =====================================================================
--  v2: YUZ TEKSHIRUVI (mavjud bazaga ham qo'llanadi — fayl qayta ishga tushirilganda)
-- =====================================================================

alter table public.companies  add column if not exists face_check     boolean not null default false;
alter table public.companies  add column if not exists face_threshold real    not null default 0.55;
alter table public.attendance add column if not exists face_status    text;   -- match | mismatch | no_face
alter table public.attendance add column if not exists face_distance  real;   -- 0 = bir xil yuz, >0.55 = boshqa odam

-- Xodimning yuz namunasi: rasm + 128 ta raqamdan iborat "yuz izi". Ishchining o'ziga ko'rinmaydi.
create table if not exists public.face_profiles (
  member_id   uuid primary key references public.members(id) on delete cascade,
  company_id  uuid not null references public.companies(id) on delete cascade,
  descriptor  real[] not null check (array_length(descriptor, 1) = 128),
  photo_path  text not null,
  consent_at  timestamptz not null default now(),
  enrolled_at timestamptz not null default now()
);

-- =====================================================================
--  v4: PAROLNI TIKLASH, «KETDIM» ESLATMASI, YANGI XODIM XABARI
-- =====================================================================

alter table public.members          add column if not exists must_change_password   boolean not null default false;
alter table public.attendance       add column if not exists check_out_auto         boolean not null default false; -- «Ketdim» bosilmagan, tizim yopgan
alter table public.attendance       add column if not exists checkout_reminded_at   timestamptz;
alter table public.company_telegram add column if not exists notify_forgot_checkout boolean not null default true;
alter table public.company_telegram add column if not exists notify_new_member      boolean not null default true;

-- =====================================================================
--  v5: YANGI KOMPANIYALARNI PLATFORMA EGASI TASDIQLAYDI
-- =====================================================================

-- Mavjud kompaniyalar 'active' bo'lib qoladi; yangi ro'yxatdan o'tganlar 'pending' bilan yaratiladi
alter table public.companies add column if not exists status text not null default 'active';
do $$ begin
  alter table public.companies add constraint companies_status_chk check (status in ('pending', 'active', 'rejected'));
exception when duplicate_object then null; end $$;

-- Platforma egasi(lar)i — kompaniyalarni tasdiqlaydi (faqat server funksiyalari orqali)
create table if not exists public.platform_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
-- Platforma xabarlari uchun Telegram (yagona qator)
create table if not exists public.platform_settings (
  id        boolean primary key default true check (id),
  bot_token text,
  chat_id   text,
  app_url   text not null default 'https://kpi-uz.netlify.app'
);

-- =====================================================================
--  v6: TELEGRAM XABARLARIDA XODIM SELFISI
-- =====================================================================

alter table public.company_telegram  add column if not exists send_photos   boolean not null default true;
alter table public.platform_settings add column if not exists functions_url text;  -- https://<ref>.supabase.co/functions/v1

-- Rasmli xabarlar navbati: server funksiyasi (tg-photo) rasmni yopiq ombordan olib, Telegram'ga yuboradi.
-- token — faqat baza va funksiya biladi; xabar bir marta yuboriladi (sent_at).
create table if not exists public.tg_outbox (
  id          bigint generated always as identity primary key,
  token       uuid not null default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  caption     text not null,
  photo_paths text[] not null default '{}',
  created_at  timestamptz not null default now(),
  sent_at     timestamptz,
  result      text
);

-- =====================================================================
--  YORDAMCHI FUNKSIYALAR
-- =====================================================================

-- Ilova bazaning versiyasini tekshiradi (sayt yangi, baza eski bo'lib qolmasligi uchun)
create or replace function public.schema_version() returns int
language sql immutable as $$ select 6 $$;

create or replace function public.my_company_id() returns uuid
language sql stable security definer set search_path = public as $$
  select m.company_id from members m join companies c on c.id = m.company_id
   where m.user_id = auth.uid() and m.status = 'active' and c.status = 'active'
$$;

-- Har qanday holatdagi (pending ham) a'zolik kompaniyasi
create or replace function public.my_company_id_any() returns uuid
language sql stable security definer set search_path = public as $$
  select company_id from members where user_id = auth.uid()
$$;

create or replace function public.my_member_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from members where user_id = auth.uid()
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members m join companies c on c.id = m.company_id
                  where m.user_id = auth.uid() and m.role = 'admin' and m.status = 'active' and c.status = 'active')
$$;

create or replace function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from platform_admins where user_id = auth.uid())
$$;

create or replace function public.geo_distance_m(lat1 double precision, lng1 double precision,
                                                 lat2 double precision, lng2 double precision)
returns double precision language sql immutable as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)))
$$;

create or replace function public.gen_join_code() returns text
language plpgsql volatile set search_path = public as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from companies where join_code = code);
  end loop;
  return code;
end $$;

-- Ishchining amaldagi jadvali (shaxsiy jadval bo'lsa — o'shani, aks holda umumiysini)
create or replace view public.member_schedule with (security_invoker = true) as
select
  m.id         as member_id,
  m.company_id,
  case when m.custom_schedule then coalesce(m.work_start,    c.work_start)    else c.work_start    end as work_start,
  case when m.custom_schedule then coalesce(m.work_end,      c.work_end)      else c.work_end      end as work_end,
  case when m.custom_schedule then coalesce(m.grace_minutes, c.grace_minutes) else c.grace_minutes end as grace_minutes,
  case when m.custom_schedule then coalesce(m.break_start,   c.break_start)   else c.break_start   end as break_start,
  case when m.custom_schedule then coalesce(m.break_end,     c.break_end)     else c.break_end     end as break_end,
  case when m.custom_schedule then coalesce(m.work_days,     c.work_days)     else c.work_days     end as work_days
from members m join companies c on c.id = m.company_id;

-- =====================================================================
--  RLS (QATOR DARAJASIDAGI XAVFSIZLIK)
-- =====================================================================

alter table public.companies        enable row level security;
alter table public.company_telegram enable row level security;
alter table public.members          enable row level security;
alter table public.attendance       enable row level security;
alter table public.holidays         enable row level security;
alter table public.tasks            enable row level security;
alter table public.ratings          enable row level security;
alter table public.face_profiles    enable row level security;
alter table public.platform_admins  enable row level security;
alter table public.platform_settings enable row level security;
alter table public.tg_outbox        enable row level security;

-- Yuz namunalarini faqat admin ko'radi va o'chiradi (qayta olish uchun). Yozish — faqat enroll_face() orqali.
drop policy if exists face_admin_select on public.face_profiles;
create policy face_admin_select on public.face_profiles for select to authenticated
  using (company_id = public.my_company_id() and public.is_admin());
drop policy if exists face_admin_delete on public.face_profiles;
create policy face_admin_delete on public.face_profiles for delete to authenticated
  using (company_id = public.my_company_id() and public.is_admin());

drop policy if exists companies_select on public.companies;
create policy companies_select on public.companies for select to authenticated
  using (id = public.my_company_id_any());
drop policy if exists companies_update on public.companies;
create policy companies_update on public.companies for update to authenticated
  using (id = public.my_company_id() and public.is_admin())
  with check (id = public.my_company_id() and public.is_admin());

drop policy if exists telegram_admin on public.company_telegram;
create policy telegram_admin on public.company_telegram for all to authenticated
  using (company_id = public.my_company_id() and public.is_admin())
  with check (company_id = public.my_company_id() and public.is_admin());

drop policy if exists members_select on public.members;
create policy members_select on public.members for select to authenticated
  using (user_id = auth.uid() or (company_id = public.my_company_id() and public.is_admin()));
drop policy if exists members_update on public.members;
create policy members_update on public.members for update to authenticated
  using (company_id = public.my_company_id() and public.is_admin())
  with check (company_id = public.my_company_id() and public.is_admin());
drop policy if exists members_delete on public.members;
create policy members_delete on public.members for delete to authenticated
  using (company_id = public.my_company_id() and public.is_admin() and user_id <> auth.uid());

drop policy if exists attendance_select on public.attendance;
create policy attendance_select on public.attendance for select to authenticated
  using (member_id = public.my_member_id() or (company_id = public.my_company_id() and public.is_admin()));
drop policy if exists attendance_admin_write on public.attendance;
create policy attendance_admin_write on public.attendance for all to authenticated
  using (company_id = public.my_company_id() and public.is_admin())
  with check (company_id = public.my_company_id() and public.is_admin());

drop policy if exists holidays_select on public.holidays;
create policy holidays_select on public.holidays for select to authenticated
  using (company_id = public.my_company_id());
drop policy if exists holidays_admin on public.holidays;
create policy holidays_admin on public.holidays for all to authenticated
  using (company_id = public.my_company_id() and public.is_admin())
  with check (company_id = public.my_company_id() and public.is_admin());

drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks for select to authenticated
  using (assignee_id = public.my_member_id() or (company_id = public.my_company_id() and public.is_admin()));
drop policy if exists tasks_admin on public.tasks;
create policy tasks_admin on public.tasks for all to authenticated
  using (company_id = public.my_company_id() and public.is_admin())
  with check (company_id = public.my_company_id() and public.is_admin());

drop policy if exists ratings_select on public.ratings;
create policy ratings_select on public.ratings for select to authenticated
  using (member_id = public.my_member_id() or (company_id = public.my_company_id() and public.is_admin()));
drop policy if exists ratings_admin on public.ratings;
create policy ratings_admin on public.ratings for all to authenticated
  using (company_id = public.my_company_id() and public.is_admin())
  with check (company_id = public.my_company_id() and public.is_admin());

-- =====================================================================
--  HIMOYA TRIGGERLARI
-- =====================================================================

-- user_id / company_id o'zgarmaydi; oxirgi adminni o'chirib bo'lmaydi
create or replace function public.members_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    new.user_id := old.user_id;
    new.company_id := old.company_id;
    if old.role = 'admin' and old.status = 'active'
       and (new.role <> 'admin' or new.status <> 'active')
       and not exists (select 1 from members where company_id = old.company_id and id <> old.id
                       and role = 'admin' and status = 'active') then
      raise exception 'LAST_ADMIN';
    end if;
    return new;
  else -- DELETE
    if old.role = 'admin' and old.status = 'active'
       and not exists (select 1 from members where company_id = old.company_id and id <> old.id
                       and role = 'admin' and status = 'active')
       and exists (select 1 from companies where id = old.company_id) then
      raise exception 'LAST_ADMIN';
    end if;
    return old;
  end if;
end $$;
drop trigger if exists members_guard_trg on public.members;
create trigger members_guard_trg before update or delete on public.members
  for each row execute function public.members_guard();

-- Vazifa bajarilgan vaqtni avtomatik qo'yish
create or replace function public.tasks_completed_at() returns trigger
language plpgsql as $$
begin
  if new.status = 'done' and (tg_op = 'INSERT' or old.status is distinct from 'done') then
    new.completed_at := coalesce(new.completed_at, now());
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  return new;
end $$;
drop trigger if exists tasks_completed_trg on public.tasks;
create trigger tasks_completed_trg before insert or update on public.tasks
  for each row execute function public.tasks_completed_at();

-- =====================================================================
--  PLATFORMA: YANGI KOMPANIYALARNI TASDIQLASH (v5)
-- =====================================================================

-- Yangi kompaniya arizasi haqida platforma egasiga Telegram xabari
create or replace function public.platform_notify_company(p_company uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s platform_settings; c companies; m members;
begin
  select * into s from platform_settings limit 1;
  if coalesce(s.bot_token, '') = '' or coalesce(s.chat_id, '') = '' then return; end if;
  select * into c from companies where id = p_company;
  select * into m from members where company_id = p_company and role = 'admin' order by created_at limit 1;
  perform net.http_post(
    url := 'https://api.telegram.org/bot' || s.bot_token || '/sendMessage',
    body := jsonb_build_object('chat_id', s.chat_id, 'disable_web_page_preview', true,
      'text', '🏢 Yangi kompaniya arizasi: ' || c.name
              || E'\nEgasi: ' || coalesce(m.full_name, '—') || coalesce(', ' || m.phone, '') || coalesce(', ' || m.email, '')
              || E'\nTasdiqlash: ' || s.app_url || '/#/platform'),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 20000
  );
exception when others then
  raise warning 'platform_notify_company: %', sqlerrm;
end $$;

-- Platforma egasi uchun kompaniyalar ro'yxati (avval kutilayotganlar)
create or replace function public.platform_companies()
returns table (id uuid, name text, status text, created_at timestamptz,
               owner_name text, owner_email text, owner_phone text, members int, last_activity date)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not is_platform_admin() then raise exception 'FORBIDDEN'; end if;
  return query
  select c.id, c.name, c.status, c.created_at, o.full_name, o.email, o.phone,
         (select count(*)::int from members x where x.company_id = c.id),
         (select max(a.work_date) from attendance a where a.company_id = c.id)
    from companies c
    left join lateral (select mm.full_name, mm.email, mm.phone from members mm
                        where mm.company_id = c.id and mm.role = 'admin' order by mm.created_at limit 1) o on true
   order by (c.status = 'pending') desc, c.created_at desc;
end $$;

-- Tasdiqlash / rad etish (o'z kompaniyasini o'zgartira olmaydi — tasodifan o'zini bloklamasin)
create or replace function public.platform_set_company_status(p_company uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_platform_admin() then raise exception 'FORBIDDEN'; end if;
  if p_status not in ('active', 'rejected', 'pending') then raise exception 'BAD_STATUS'; end if;
  if exists (select 1 from members where company_id = p_company and user_id = auth.uid()) then
    raise exception 'OWN_COMPANY';
  end if;
  update companies set status = p_status where id = p_company;
  if not found then raise exception 'NOT_FOUND'; end if;
end $$;

-- =====================================================================
--  RO'YXATDAN O'TISH
-- =====================================================================

-- Yangi foydalanuvchi: metadata'dagi "intent" bo'yicha kompaniya yaratiladi yoki qo'shiladi
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_company uuid;
  v_lang text := case when meta->>'lang' in ('uz','ru','en') then meta->>'lang' else 'uz' end;
  v_name text := coalesce(nullif(trim(meta->>'full_name'), ''), split_part(new.email, '@', 1));
begin
  if meta->>'intent' = 'create_company' then
    insert into companies (name, join_code, default_lang, status)
    values (coalesce(nullif(trim(meta->>'company_name'), ''), 'Company'), gen_join_code(), v_lang, 'pending')
    returning id into v_company;
    insert into company_telegram (company_id) values (v_company);
    insert into members (company_id, user_id, full_name, email, phone, role, status, track_attendance)
    values (v_company, new.id, v_name, new.email, nullif(meta->>'phone', ''), 'admin', 'active', false);
    perform platform_notify_company(v_company);
  elsif meta->>'intent' = 'join' then
    select id into v_company from companies where join_code = upper(trim(meta->>'join_code')) and status = 'active';
    if v_company is not null then
      insert into members (company_id, user_id, full_name, email, phone, role, status)
      values (v_company, new.id, v_name, new.email, nullif(meta->>'phone', ''), 'employee', 'pending');
    end if;
  end if;
  return new;
exception when others then
  raise warning 'handle_new_user: %', sqlerrm;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Kodni oldindan tekshirish (ro'yxatdan o'tish sahifasida kompaniya nomini ko'rsatish uchun)
create or replace function public.check_join_code(p_code text) returns text
language sql stable security definer set search_path = public as $$
  select name from companies where join_code = upper(trim(p_code)) and status = 'active'
$$;

create or replace function public.create_company(p_name text, p_full_name text, p_lang text default 'uz')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_company uuid; v_email text;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if exists (select 1 from members where user_id = auth.uid()) then raise exception 'ALREADY_MEMBER'; end if;
  select email into v_email from auth.users where id = auth.uid();
  insert into companies (name, join_code, default_lang, status)
  values (coalesce(nullif(trim(p_name), ''), 'Company'), gen_join_code(),
          case when p_lang in ('uz','ru','en') then p_lang else 'uz' end, 'pending')
  returning id into v_company;
  insert into company_telegram (company_id) values (v_company);
  insert into members (company_id, user_id, full_name, email, role, status, track_attendance)
  values (v_company, auth.uid(), coalesce(nullif(trim(p_full_name), ''), v_email), v_email, 'admin', 'active', false);
  perform platform_notify_company(v_company);
  return v_company;
end $$;

create or replace function public.join_company(p_code text, p_full_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_company uuid; v_email text;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if exists (select 1 from members where user_id = auth.uid()) then raise exception 'ALREADY_MEMBER'; end if;
  select id into v_company from companies where join_code = upper(trim(p_code)) and status = 'active';
  if v_company is null then raise exception 'INVALID_CODE'; end if;
  select email into v_email from auth.users where id = auth.uid();
  insert into members (company_id, user_id, full_name, email, role, status)
  values (v_company, auth.uid(), coalesce(nullif(trim(p_full_name), ''), v_email), v_email, 'employee', 'pending');
  return v_company;
end $$;

-- Rad etilgan / o'chirilgan foydalanuvchi o'zini kompaniyadan chiqarishi (pending holatda)
create or replace function public.leave_pending() returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from members where user_id = auth.uid() and status = 'pending';
end $$;

create or replace function public.regenerate_join_code() returns text
language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  if not is_admin() then raise exception 'FORBIDDEN'; end if;
  v_code := gen_join_code();
  update companies set join_code = v_code where id = my_company_id();
  return v_code;
end $$;

create or replace function public.update_my_profile(p_full_name text, p_phone text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update members
     set full_name = coalesce(nullif(trim(p_full_name), ''), full_name),
         phone = nullif(trim(p_phone), '')
   where user_id = auth.uid();
end $$;

-- =====================================================================
--  KELDIM / KETDIM
-- =====================================================================

create or replace function public.my_today() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  m members; c companies; s member_schedule; a attendance;
  v_local timestamp; v_date date; v_holiday text; v_workday boolean;
begin
  select * into m from members where user_id = auth.uid();
  if m.id is null then raise exception 'NOT_MEMBER'; end if;
  select * into c from companies where id = m.company_id;
  select * into s from member_schedule where member_id = m.id;
  v_local := now() at time zone c.timezone;
  v_date := v_local::date;
  select name into v_holiday from holidays where company_id = c.id and day = v_date;
  v_workday := extract(isodow from v_date)::int = any(s.work_days) and not exists
               (select 1 from holidays where company_id = c.id and day = v_date);
  select * into a from attendance where member_id = m.id and work_date = v_date;
  return jsonb_build_object(
    'date', v_date,
    'now_local', to_char(v_local, 'YYYY-MM-DD"T"HH24:MI:SS'),
    'is_workday', v_workday,
    'holiday', v_holiday,
    'schedule', jsonb_build_object('work_start', s.work_start, 'work_end', s.work_end,
                  'grace_minutes', s.grace_minutes, 'break_start', s.break_start,
                  'break_end', s.break_end, 'work_days', s.work_days),
    'office', jsonb_build_object('lat', c.office_lat, 'lng', c.office_lng, 'radius_m', c.radius_m,
                  'require_selfie', c.require_selfie, 'timezone', c.timezone, 'name', c.name),
    'face', jsonb_build_object('required', c.require_selfie and c.face_check,
                  'enrolled', exists (select 1 from face_profiles f where f.member_id = m.id)),
    'attendance', case when a.id is null then null else to_jsonb(a) end
  );
end $$;

-- Ikki "yuz izi" orasidagi masofa (Evklid). ~0.3–0.45 — bir odam, ~0.6+ — boshqa odam.
create or replace function public.face_distance(a real[], b real[]) returns real
language sql immutable as $$
  select sqrt(sum(power(x.va - x.vb, 2)))::real
    from unnest(a, b) as x(va, vb)
$$;

create or replace function public.jsonb_to_face(p jsonb) returns real[]
language sql immutable as $$
  select case when jsonb_typeof(p) = 'array' and jsonb_array_length(p) = 128
              then array(select v::real from jsonb_array_elements_text(p) with ordinality as t(v, i) order by i)
         end
$$;

-- Yuz namunasi kerakmi va olinganmi (ro'yxatdan o'tgan, hali tasdiqlanmagan xodim uchun ham)
create or replace function public.my_face_status() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'required', coalesce(c.require_selfie and c.face_check, false),
    'enrolled', exists (select 1 from face_profiles f where f.member_id = m.id))
    from members m join companies c on c.id = m.company_id
   where m.user_id = auth.uid()
$$;

-- Xodim o'z yuz namunasini beradi (bir marta; qayta olish uchun admin eskisini o'chiradi)
create or replace function public.enroll_face(p_descriptor jsonb, p_photo text, p_consent boolean)
returns void language plpgsql security definer set search_path = public as $$
declare m members; v_desc real[];
begin
  select * into m from members where user_id = auth.uid();
  if m.id is null then raise exception 'NOT_MEMBER'; end if;
  if m.status = 'inactive' then raise exception 'NOT_ACTIVE'; end if;
  if not coalesce(p_consent, false) then raise exception 'FACE_CONSENT_REQUIRED'; end if;
  v_desc := jsonb_to_face(p_descriptor);
  if v_desc is null then raise exception 'FACE_NOT_FOUND'; end if;
  if p_photo is null or p_photo not like (m.company_id::text || '/' || auth.uid()::text || '/%')
     or not exists (select 1 from storage.objects where bucket_id = 'selfies' and name = p_photo) then
    raise exception 'SELFIE_INVALID';
  end if;
  if exists (select 1 from face_profiles where member_id = m.id) then raise exception 'FACE_ALREADY_ENROLLED'; end if;
  insert into face_profiles (member_id, company_id, descriptor, photo_path) values (m.id, m.company_id, v_desc, p_photo);
end $$;

-- Eski (yuz tekshiruvisiz) versiyani olib tashlash
drop function if exists public.check_in(double precision, double precision, double precision, text);

create or replace function public.check_in(p_lat double precision, p_lng double precision,
                                           p_accuracy double precision default null,
                                           p_selfie text default null,
                                           p_face jsonb default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  m members; c companies; s member_schedule; a attendance;
  v_now timestamptz := now(); v_local timestamp; v_date date; v_time time;
  v_dist double precision; v_workday boolean; v_late int := 0; v_status text := 'present';
  v_ref real[]; v_face real[]; v_face_status text; v_face_dist real;
begin
  select * into m from members where user_id = auth.uid();
  if m.id is null then raise exception 'NOT_MEMBER'; end if;
  if m.status <> 'active' then raise exception 'NOT_ACTIVE'; end if;
  select * into c from companies where id = m.company_id;
  if c.status <> 'active' then raise exception 'NOT_ACTIVE'; end if;
  if c.office_lat is null or c.office_lng is null then raise exception 'NO_OFFICE_LOCATION'; end if;
  if p_lat is null or p_lng is null or abs(p_lat) > 90 or abs(p_lng) > 180 then raise exception 'BAD_LOCATION'; end if;
  v_date := (v_now at time zone c.timezone)::date;
  if exists (select 1 from attendance where member_id = m.id and work_date = v_date and check_in_at is not null) then
    raise exception 'ALREADY_CHECKED_IN';
  end if;

  -- Juda noaniq joylashuv (masalan, IP bo'yicha) qabul qilinmaydi
  if p_accuracy is not null and p_accuracy > greatest(c.radius_m * 2, 300) then
    raise exception 'LOW_ACCURACY' using hint = round(p_accuracy)::text;
  end if;
  v_dist := geo_distance_m(p_lat, p_lng, c.office_lat, c.office_lng);
  if v_dist > c.radius_m then
    raise exception 'OUT_OF_RANGE' using hint = round(v_dist)::text;
  end if;

  if c.require_selfie then
    if p_selfie is null then raise exception 'SELFIE_REQUIRED'; end if;
    if p_selfie not like (c.id::text || '/' || auth.uid()::text || '/%')
       or not exists (select 1 from storage.objects where bucket_id = 'selfies' and name = p_selfie) then
      raise exception 'SELFIE_INVALID';
    end if;
  end if;

  -- Yuzni namunaga solishtirish: mos kelmasa ham kelish yoziladi, lekin "shubhali" deb belgilanadi
  if c.require_selfie and c.face_check then
    select descriptor into v_ref from face_profiles where member_id = m.id;
    if v_ref is null then raise exception 'FACE_NOT_ENROLLED'; end if;
    v_face := jsonb_to_face(p_face);
    if v_face is null then
      v_face_status := 'no_face';
    else
      v_face_dist := face_distance(v_ref, v_face);
      v_face_status := case when v_face_dist <= c.face_threshold then 'match' else 'mismatch' end;
    end if;
  end if;

  select * into s from member_schedule where member_id = m.id;
  v_local := v_now at time zone c.timezone;
  v_date := v_local::date;
  v_time := v_local::time;
  v_workday := extract(isodow from v_date)::int = any(s.work_days)
               and not exists (select 1 from holidays where company_id = c.id and day = v_date);

  if v_workday then
    v_late := greatest(0, floor(extract(epoch from (v_time - s.work_start)) / 60))::int;
    if v_late > s.grace_minutes then v_status := 'late'; else v_late := 0; end if;
  end if;

  select * into a from attendance where member_id = m.id and work_date = v_date for update;
  if a.id is not null and a.check_in_at is not null then raise exception 'ALREADY_CHECKED_IN'; end if;

  if a.id is null then
    insert into attendance (company_id, member_id, work_date, status, check_in_at, check_in_lat, check_in_lng,
                            check_in_accuracy, check_in_distance, check_in_selfie, late_minutes,
                            face_status, face_distance)
    values (c.id, m.id, v_date, v_status, v_now, p_lat, p_lng, p_accuracy, round(v_dist), p_selfie, v_late,
            v_face_status, v_face_dist)
    returning * into a;
  else
    update attendance
       set status = v_status, check_in_at = v_now, check_in_lat = p_lat, check_in_lng = p_lng,
           check_in_accuracy = p_accuracy, check_in_distance = round(v_dist),
           check_in_selfie = p_selfie, late_minutes = v_late,
           face_status = v_face_status, face_distance = v_face_dist
     where id = a.id
    returning * into a;
  end if;
  return to_jsonb(a);
end $$;

create or replace function public.check_out(p_lat double precision, p_lng double precision,
                                            p_accuracy double precision default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  m members; c companies; s member_schedule; a attendance;
  v_now timestamptz := now(); v_local timestamp; v_date date; v_time time; v_in time;
  v_dist double precision; v_workday boolean; v_early int := 0; v_worked int; v_break int := 0;
begin
  select * into m from members where user_id = auth.uid();
  if m.id is null then raise exception 'NOT_MEMBER'; end if;
  if m.status <> 'active' then raise exception 'NOT_ACTIVE'; end if;
  select * into c from companies where id = m.company_id;
  if c.status <> 'active' then raise exception 'NOT_ACTIVE'; end if;
  if c.office_lat is null then raise exception 'NO_OFFICE_LOCATION'; end if;
  if p_lat is null or p_lng is null then raise exception 'BAD_LOCATION'; end if;

  v_dist := geo_distance_m(p_lat, p_lng, c.office_lat, c.office_lng);
  if v_dist > c.radius_m then
    raise exception 'OUT_OF_RANGE' using hint = round(v_dist)::text;
  end if;

  select * into s from member_schedule where member_id = m.id;
  v_local := v_now at time zone c.timezone;
  v_date := v_local::date;
  v_time := v_local::time;

  select * into a from attendance where member_id = m.id and work_date = v_date for update;
  if a.id is null or a.check_in_at is null then raise exception 'NOT_CHECKED_IN'; end if;
  if a.check_out_at is not null then raise exception 'ALREADY_CHECKED_OUT'; end if;

  v_workday := extract(isodow from v_date)::int = any(s.work_days)
               and not exists (select 1 from holidays where company_id = c.id and day = v_date);
  if v_workday then
    v_early := greatest(0, ceil(extract(epoch from (s.work_end - v_time)) / 60))::int;
  end if;

  v_in := (a.check_in_at at time zone c.timezone)::time;
  if s.break_start is not null and s.break_end is not null and s.break_end > s.break_start then
    v_break := greatest(0, floor(extract(epoch from (least(v_time, s.break_end) - greatest(v_in, s.break_start))) / 60))::int;
  end if;
  v_worked := greatest(0, floor(extract(epoch from (v_now - a.check_in_at)) / 60)::int - v_break);

  update attendance
     set check_out_at = v_now, check_out_lat = p_lat, check_out_lng = p_lng,
         check_out_accuracy = p_accuracy, check_out_distance = round(v_dist),
         early_leave_minutes = v_early, worked_minutes = v_worked
   where id = a.id
  returning * into a;
  return to_jsonb(a);
end $$;

-- Admin ketish vaqtini qo'yadi yoki tuzatadi (masalan, avtomatik yopilgan kun uchun). NULL — ketishni bekor qiladi.
create or replace function public.admin_set_checkout(p_attendance uuid, p_time time)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a attendance; c companies; s member_schedule;
  v_out timestamptz; v_in time; v_workday boolean; v_early int := 0; v_break int := 0;
begin
  if not is_admin() then raise exception 'FORBIDDEN'; end if;
  select * into a from attendance where id = p_attendance and company_id = my_company_id() for update;
  if a.id is null then raise exception 'NOT_FOUND'; end if;
  if a.check_in_at is null then raise exception 'NOT_CHECKED_IN'; end if;
  select * into c from companies where id = a.company_id;
  select * into s from member_schedule where member_id = a.member_id;

  if p_time is null then
    update attendance set check_out_at = null, check_out_lat = null, check_out_lng = null, check_out_accuracy = null,
           check_out_distance = null, worked_minutes = null, early_leave_minutes = 0, check_out_auto = false,
           edited_by = my_member_id(), edited_at = now()
     where id = a.id returning * into a;
    return to_jsonb(a);
  end if;

  v_in := (a.check_in_at at time zone c.timezone)::time;
  v_out := (a.work_date + p_time) at time zone c.timezone;
  if v_out < a.check_in_at then raise exception 'CHECKOUT_BEFORE_CHECKIN'; end if;

  v_workday := extract(isodow from a.work_date)::int = any(s.work_days)
               and not exists (select 1 from holidays where company_id = c.id and day = a.work_date);
  if v_workday then
    v_early := greatest(0, ceil(extract(epoch from (s.work_end - p_time)) / 60))::int;
  end if;
  if s.break_start is not null and s.break_end is not null and s.break_end > s.break_start then
    v_break := greatest(0, floor(extract(epoch from (least(p_time, s.break_end) - greatest(v_in, s.break_start))) / 60))::int;
  end if;

  update attendance
     set check_out_at = v_out, early_leave_minutes = v_early,
         worked_minutes = greatest(0, floor(extract(epoch from (v_out - a.check_in_at)) / 60)::int - v_break),
         check_out_auto = false, edited_by = my_member_id(), edited_at = now()
   where id = a.id
  returning * into a;
  return to_jsonb(a);
end $$;

-- Admin xodimga vaqtinchalik parol beradi: eski parol ishlamay qoladi, barcha qurilmalardan chiqariladi,
-- keyingi kirishda xodim o'z parolini o'rnatadi. Parol faqat shu javobda bir marta ko'rinadi.
create or replace function public.admin_reset_password(p_member uuid) returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  m members; v_pw text := '';
  alphabet text := 'abcdefghjkmnpqrstuvwxyz23456789';
  b bytea := extensions.gen_random_bytes(8);
begin
  if not is_admin() then raise exception 'FORBIDDEN'; end if;
  select * into m from members where id = p_member and company_id = my_company_id();
  if m.id is null then raise exception 'NOT_FOUND'; end if;
  if m.user_id = auth.uid() then raise exception 'USE_PROFILE'; end if;
  for i in 0..7 loop
    v_pw := v_pw || substr(alphabet, 1 + get_byte(b, i) % length(alphabet), 1);
  end loop;
  update auth.users set encrypted_password = extensions.crypt(v_pw, extensions.gen_salt('bf')), updated_at = now()
   where id = m.user_id;
  delete from auth.sessions where user_id = m.user_id;
  update members set must_change_password = true where id = m.id;
  return v_pw;
end $$;

-- Xodim yangi parol o'rnatgandan keyin belgini olib tashlaydi
create or replace function public.password_changed() returns void
language sql security definer set search_path = public as $$
  update members set must_change_password = false where user_id = auth.uid()
$$;

-- «Ketdim» unutilgan kunlar (pg_cron har 10 daqiqada chaqiradi):
-- 1) ish tugaganidan 30 daqiqa o'tib Telegram guruhiga eslatma; 2) yarim tundan keyin kunni ish tugash vaqti bilan yopish.
create or replace function public.run_checkout_tasks() returns void
language plpgsql security definer set search_path = public as $$
declare c record; o record; v_list text;
begin
  -- Rasmli xabar 3 daqiqada yuborilmagan bo'lsa (funksiya ishlamadi) — matnini yuboramiz, xabar yo'qolmasin
  for o in
    update tg_outbox set sent_at = now(), result = 'fallback'
     where sent_at is null and created_at < now() - interval '3 minutes'
    returning company_id, caption
  loop
    perform tg_send(o.company_id, o.caption);
  end loop;

  update attendance a
     set check_out_at = x.out_at, check_out_auto = true, early_leave_minutes = 0,
         worked_minutes = greatest(0, floor(extract(epoch from (x.out_at - a.check_in_at)) / 60)::int - x.brk)
    from (
      select a2.id,
             greatest(a2.check_in_at, (a2.work_date + s.work_end) at time zone co.timezone) as out_at,
             case when s.break_start is not null and s.break_end is not null and s.break_end > s.break_start
                  then greatest(0, floor(extract(epoch from (least(s.work_end, s.break_end)
                         - greatest((a2.check_in_at at time zone co.timezone)::time, s.break_start))) / 60))::int
                  else 0 end as brk
        from attendance a2
        join companies co on co.id = a2.company_id
        join member_schedule s on s.member_id = a2.member_id
       where a2.check_in_at is not null and a2.check_out_at is null
         and a2.work_date < (now() at time zone co.timezone)::date
    ) x
   where a.id = x.id;

  for c in
    select co.id, co.timezone, co.default_lang
      from companies co join company_telegram t on t.company_id = co.id
     where t.enabled and t.notify_forgot_checkout and coalesce(t.bot_token, '') <> '' and coalesce(t.chat_id, '') <> ''
  loop
    with due as (
      select a.id, m.full_name, s.work_end
        from attendance a
        join members m on m.id = a.member_id
        join member_schedule s on s.member_id = a.member_id
       where a.company_id = c.id and m.status = 'active'
         and a.work_date = (now() at time zone c.timezone)::date
         and a.check_in_at is not null and a.check_out_at is null and a.checkout_reminded_at is null
         and s.work_end < time '23:30'
         and (now() at time zone c.timezone)::time >= s.work_end + interval '30 minutes'
         and (a.check_in_at at time zone c.timezone)::time < s.work_end
    ), marked as (
      update attendance set checkout_reminded_at = now() where id in (select id from due) returning id
    )
    select string_agg(due.full_name || ' (' || to_char(due.work_end, 'HH24:MI') || ')', E'\n• ' order by due.full_name)
      into v_list from due;

    if v_list is not null then
      perform tg_send(c.id, case c.default_lang
        when 'ru' then E'🏁 Не отметили «Ушёл» (рабочий день закончился более 30 мин назад):\n• ' || v_list
                       || E'\nЕсли не отметить, в полночь день закроется автоматически по времени окончания работы.'
        when 'en' then E'🏁 Forgot to check out (work ended over 30 min ago):\n• ' || v_list
                       || E'\nIf not checked out, the day closes automatically at midnight with the scheduled end time.'
        else E'🏁 «Ketdim» belgilanmagan (ish tugaganiga 30 daqiqadan oshdi):\n• ' || v_list
             || E'\nBelgilanmasa, yarim tunda kun ish tugash vaqti bilan avtomatik yopiladi.' end);
    end if;
  end loop;
end $$;

-- Ishchi o'z vazifasi holatini o'zgartiradi
create or replace function public.set_task_status(p_task uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('todo','in_progress','done') then raise exception 'BAD_STATUS'; end if;
  update tasks set status = p_status
   where id = p_task and assignee_id = (select id from members where user_id = auth.uid() and status = 'active');
  if not found then raise exception 'FORBIDDEN'; end if;
end $$;

-- =====================================================================
--  HISOBOTLAR
-- =====================================================================

-- Har bir ishchi × har bir kun uchun holat. Admin — hammani, ishchi — faqat o'zini ko'radi.
-- status: present | late | excused | absent | not_yet | future | off | holiday
drop function if exists public.attendance_grid(date, date);
create or replace function public.attendance_grid(p_from date, p_to date)
returns table (
  member_id uuid, full_name text, "position" text, day date, expected boolean, status text,
  attendance_id uuid, check_in_at timestamptz, check_out_at timestamptz,
  late_minutes int, early_leave_minutes int, worked_minutes int,
  check_in_distance int, check_out_distance int, check_in_accuracy double precision,
  check_in_selfie text, note text, work_start time, work_end time,
  face_status text, face_distance real, check_out_auto boolean
)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_company uuid; v_admin boolean; v_me uuid; v_tz text; v_today date; v_now_t time;
begin
  select mm.company_id, mm.role = 'admin', mm.id into v_company, v_admin, v_me
    from members mm where mm.user_id = auth.uid() and mm.status = 'active';
  if v_company is null then raise exception 'NOT_ACTIVE'; end if;
  if p_to - p_from > 62 then raise exception 'RANGE_TOO_LARGE'; end if;
  select timezone into v_tz from companies where id = v_company;
  v_today := (now() at time zone v_tz)::date;
  v_now_t := (now() at time zone v_tz)::time;

  return query
  with mem as (
    select mm.id, mm.full_name, mm.position, mm.start_date, s.work_days, s.work_start, s.work_end
      from members mm join member_schedule s on s.member_id = mm.id
     where mm.company_id = v_company and mm.status = 'active'
       and ((v_admin and mm.track_attendance) or (not v_admin and mm.id = v_me))
  ),
  days as (select d::date as day from generate_series(p_from, p_to, interval '1 day') d),
  hol as (select h.day from holidays h where h.company_id = v_company and h.day between p_from and p_to)
  select mem.id, mem.full_name, mem.position, days.day,
         (extract(isodow from days.day)::int = any(mem.work_days)
           and days.day >= mem.start_date and hol.day is null) as expected,
         case
           when a.status = 'excused' then 'excused'
           when a.status = 'absent' then 'absent'
           when a.id is not null and a.status in ('present','late') then a.status
           when hol.day is not null then 'holiday'
           when not (extract(isodow from days.day)::int = any(mem.work_days)) or days.day < mem.start_date then 'off'
           when days.day > v_today then 'future'
           when days.day = v_today and v_now_t <= mem.work_end then 'not_yet'
           else 'absent'
         end,
         a.id, a.check_in_at, a.check_out_at, a.late_minutes, a.early_leave_minutes, a.worked_minutes,
         a.check_in_distance, a.check_out_distance, a.check_in_accuracy, a.check_in_selfie, a.note,
         mem.work_start, mem.work_end, a.face_status, a.face_distance, coalesce(a.check_out_auto, false)
    from mem cross join days
    left join hol on hol.day = days.day
    left join attendance a on a.member_id = mem.id and a.work_date = days.day
   order by mem.full_name, days.day;
end $$;

-- Grafik uchun kunlik yig'indi
create or replace function public.daily_stats(p_from date, p_to date)
returns table (day date, expected int, on_time int, late int, absent int, excused int, not_yet int)
language sql stable security definer set search_path = public as $$
  select g.day,
         count(*) filter (where g.expected)::int,
         count(*) filter (where g.status = 'present')::int,
         count(*) filter (where g.status = 'late')::int,
         count(*) filter (where g.status = 'absent')::int,
         count(*) filter (where g.status = 'excused')::int,
         count(*) filter (where g.status = 'not_yet')::int
    from public.attendance_grid(p_from, p_to) g
   group by g.day order by g.day
$$;

-- Oylik matritsa (ishchilar × kunlar) — bitta JSON qiymat sifatida
create or replace function public.month_matrix(p_month date) returns jsonb
language sql stable security definer set search_path = public as $$
  with g as (
    select * from public.attendance_grid(date_trunc('month', p_month)::date,
                                         (date_trunc('month', p_month) + interval '1 month - 1 day')::date)
  )
  select coalesce(jsonb_agg(x order by x->>'full_name'), '[]'::jsonb) from (
    select jsonb_build_object('member_id', member_id, 'full_name', min(full_name),
             'days', jsonb_agg(jsonb_build_object('d', extract(day from day)::int, 's', status,
                                                  'l', late_minutes) order by day)) as x
      from g group by member_id
  ) t
$$;

-- Oylik KPI va oylik maosh hisoboti
create or replace function public.month_report(p_month date)
returns table (
  member_id uuid, full_name text, "position" text, base_salary numeric,
  planned_days int, required_days int, on_time_days int, late_days int, absent_days int, excused_days int,
  late_minutes int, early_minutes int, worked_minutes int,
  tasks_total int, tasks_done_on_time int, tasks_done_late int,
  rating int, attendance_score numeric, task_score numeric, rating_score numeric, kpi numeric,
  fixed_part numeric, kpi_part numeric, absence_deduction numeric, late_fine numeric, early_fine numeric,
  salary numeric
)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  c companies; v_company uuid; v_start date; v_end date; v_today date;
begin
  v_company := my_company_id();
  if v_company is null then raise exception 'NOT_ACTIVE'; end if;
  select * into c from companies where id = v_company;
  v_start := date_trunc('month', p_month)::date;
  v_end := (v_start + interval '1 month - 1 day')::date;
  v_today := (now() at time zone c.timezone)::date;

  return query
  with g as (select * from attendance_grid(v_start, v_end)),
  mem as (
    select mm.id, mm.full_name, mm.position, mm.base_salary, s.work_days
      from members mm join member_schedule s on s.member_id = mm.id
     where mm.id in (select distinct g.member_id from g)
  ),
  full_month as (   -- kompaniya/ishchi jadvali bo'yicha oydagi jami ish kunlari (ishga kirgan sanadan qat'i nazar)
    select mem.id as member_id, count(*)::int as days
      from mem cross join generate_series(v_start, v_end, interval '1 day') d
     where extract(isodow from d)::int = any(mem.work_days)
       and not exists (select 1 from holidays h where h.company_id = v_company and h.day = d::date)
     group by mem.id
  ),
  att as (
    select g.member_id,
           count(*) filter (where g.expected)::int as planned,
           count(*) filter (where g.expected and g.status in ('present','late','absent','excused'))::int as required,
           count(*) filter (where g.expected and g.status = 'present')::int as on_time,
           count(*) filter (where g.expected and g.status = 'late')::int as late,
           count(*) filter (where g.expected and g.status = 'absent')::int as absent,
           count(*) filter (where g.expected and g.status = 'excused')::int as excused,
           coalesce(sum(g.late_minutes) filter (where g.status = 'late'), 0)::int as late_min,
           coalesce(sum(g.early_leave_minutes) filter (where g.status in ('present','late')), 0)::int as early_min,
           coalesce(sum(g.worked_minutes), 0)::int as worked
      from g group by g.member_id
  ),
  tk as (
    select t.assignee_id as member_id,
           count(*)::int as total,
           count(*) filter (where t.status = 'done' and (t.completed_at at time zone c.timezone)::date <= t.due_date)::int as on_time,
           count(*) filter (where t.status = 'done' and (t.completed_at at time zone c.timezone)::date > t.due_date)::int as late,
           sum(t.points)::numeric as pts,
           sum(t.points * case when t.status = 'done' and (t.completed_at at time zone c.timezone)::date <= t.due_date then 1.0
                               when t.status = 'done' then 0.5 else 0 end)::numeric as earned
      from tasks t
     where t.company_id = v_company and t.due_date between v_start and v_end
       and (t.due_date <= v_today or t.status = 'done')
     group by t.assignee_id
  ),
  rt as (select r.member_id, r.score from ratings r where r.company_id = v_company and r.period = v_start),
  sc as (
    select mem.*, att.*, coalesce(fm.days, 0) as full_days,
           tk.total as t_total, tk.on_time as t_on_time, tk.late as t_late,
           rt.score as r_score,
           case when att.required - att.excused > 0
                then round(100.0 * (att.on_time + att.late * c.late_day_credit) / (att.required - att.excused), 1) end as s_att,
           case when tk.pts > 0 then round(100.0 * tk.earned / tk.pts, 1) end as s_task,
           case when rt.score is not null then rt.score * 10.0 end as s_rate
      from mem
      join att on att.member_id = mem.id
      left join full_month fm on fm.member_id = mem.id
      left join tk on tk.member_id = mem.id
      left join rt on rt.member_id = mem.id
  ),
  k as (
    select sc.*,
           case when (case when s_att  is not null then c.w_attendance else 0 end
                    + case when s_task is not null then c.w_tasks else 0 end
                    + case when s_rate is not null then c.w_rating else 0 end) > 0
                then round((coalesce(s_att, 0) * case when s_att  is not null then c.w_attendance else 0 end
                          + coalesce(s_task, 0) * case when s_task is not null then c.w_tasks else 0 end
                          + coalesce(s_rate, 0) * case when s_rate is not null then c.w_rating else 0 end)
                         / (case when s_att  is not null then c.w_attendance else 0 end
                          + case when s_task is not null then c.w_tasks else 0 end
                          + case when s_rate is not null then c.w_rating else 0 end), 1)
           end as v_kpi,
           sc.base_salary * (100 - c.kpi_salary_share) / 100.0 as fixed_base,
           sc.base_salary * c.kpi_salary_share / 100.0 as kpi_base,
           case when sc.full_days > 0 then least(1.0, sc.planned::numeric / sc.full_days) else 0 end as prorate
      from sc
  ),
  money as (
    select k.*,
           round(k.fixed_base * k.prorate) as m_fixed,
           round(k.kpi_base * k.prorate * coalesce(k.v_kpi, 0) / 100.0) as m_kpi,
           case when c.deduct_absent_days and k.full_days > 0
                then round(k.fixed_base * k.absent / k.full_days) else 0 end as m_abs,
           round(k.late * c.late_fine_per_case + k.late_min * c.late_fine_per_minute) as m_late,
           round(k.early_min * c.early_fine_per_minute) as m_early
      from k
  )
  select money.id, money.full_name, money.position, money.base_salary,
         money.planned, money.required, money.on_time, money.late, money.absent, money.excused,
         money.late_min, money.early_min, money.worked,
         coalesce(money.t_total, 0), coalesce(money.t_on_time, 0), coalesce(money.t_late, 0),
         money.r_score, money.s_att, money.s_task, money.s_rate, money.v_kpi,
         money.m_fixed, money.m_kpi, money.m_abs, money.m_late, money.m_early,
         greatest(0, money.m_fixed + money.m_kpi - money.m_abs - money.m_late - money.m_early)
    from money
   order by money.full_name;
end $$;

-- =====================================================================
--  TELEGRAM
-- =====================================================================

create or replace function public.tg_send(p_company uuid, p_text text) returns void
language plpgsql security definer set search_path = public as $$
declare t company_telegram;
begin
  select * into t from company_telegram where company_id = p_company;
  if t.company_id is null or not t.enabled or coalesce(t.bot_token, '') = '' or coalesce(t.chat_id, '') = '' then
    return;
  end if;
  perform net.http_post(
    url := 'https://api.telegram.org/bot' || t.bot_token || '/sendMessage',
    body := jsonb_build_object('chat_id', t.chat_id, 'text', p_text, 'disable_web_page_preview', true),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 20000
  );
exception when others then
  raise warning 'tg_send: %', sqlerrm;
end $$;
revoke execute on function public.tg_send(uuid, text) from public, anon, authenticated;

-- Rasmli xabar: rasm bo'lmasa, o'chirilgan bo'lsa yoki funksiya manzili yo'q bo'lsa — oddiy matn
create or replace function public.tg_send_photo(p_company uuid, p_text text, p_paths text[]) returns void
language plpgsql security definer set search_path = public as $$
declare t company_telegram; v_url text; v_id bigint; v_token uuid; v_paths text[];
begin
  select * into t from company_telegram where company_id = p_company;
  if t.company_id is null or not t.enabled or coalesce(t.bot_token, '') = '' or coalesce(t.chat_id, '') = '' then
    return;
  end if;
  v_paths := array(select x from unnest(p_paths) as x where coalesce(x, '') <> '');
  select functions_url into v_url from platform_settings limit 1;
  if not t.send_photos or cardinality(v_paths) = 0 or coalesce(v_url, '') = '' then
    perform tg_send(p_company, p_text);
    return;
  end if;
  insert into tg_outbox (company_id, caption, photo_paths) values (p_company, p_text, v_paths)
  returning id, token into v_id, v_token;
  perform net.http_post(
    url := v_url || '/tg-photo',
    body := jsonb_build_object('id', v_id, 'token', v_token),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 20000
  );
exception when others then
  raise warning 'tg_send_photo: %', sqlerrm;
  perform tg_send(p_company, p_text);
end $$;
revoke execute on function public.tg_send_photo(uuid, text, text[]) from public, anon, authenticated;

create or replace function public.attendance_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  t company_telegram; c companies; v_name text; v_lang text; v_time text; v_msg text;
begin
  select * into t from company_telegram where company_id = new.company_id;
  if t.company_id is null or not t.enabled then return new; end if;
  select * into c from companies where id = new.company_id;
  select full_name into v_name from members where id = new.member_id;
  v_lang := c.default_lang;

  -- Kelish
  if new.check_in_at is not null and (tg_op = 'INSERT' or old.check_in_at is null) then
    v_time := to_char(new.check_in_at at time zone c.timezone, 'HH24:MI');
    if new.status = 'late' and t.notify_late then
      v_msg := case v_lang
        when 'ru' then '⏰ ' || v_name || ' опоздал(а) на ' || new.late_minutes || ' мин. Пришёл(ла) в ' || v_time
        when 'en' then '⏰ ' || v_name || ' is late by ' || new.late_minutes || ' min. Arrived at ' || v_time
        else '⏰ ' || v_name || ' kechikdi: ' || new.late_minutes || ' daqiqa. Kelgan vaqti: ' || v_time end;
    elsif t.notify_checkin then
      v_msg := case v_lang
        when 'ru' then '✅ ' || v_name || ' пришёл(ла) в ' || v_time
        when 'en' then '✅ ' || v_name || ' checked in at ' || v_time
        else '✅ ' || v_name || ' keldi: ' || v_time end;
    end if;
    if v_msg is not null then perform tg_send_photo(new.company_id, v_msg, array[new.check_in_selfie]); end if;

    -- Yuz mos kelmasa — har doim ogohlantirish
    if new.face_status in ('mismatch', 'no_face') then
      perform tg_send_photo(new.company_id, case v_lang
        when 'ru' then '⚠️ ' || v_name || ': ' || case when new.face_status = 'no_face' then 'лицо на селфи не обнаружено'
                       else 'лицо не совпало с образцом (сходство ' || greatest(0, round((1 - new.face_distance) * 100)) || '%)' end
                       || '. Проверьте селфи в разделе «Посещаемость».'
        when 'en' then '⚠️ ' || v_name || ': ' || case when new.face_status = 'no_face' then 'no face found in the selfie'
                       else 'face does not match the reference (similarity ' || greatest(0, round((1 - new.face_distance) * 100)) || '%)' end
                       || '. Check the selfie under Attendance.'
        else '⚠️ ' || v_name || ': ' || case when new.face_status = 'no_face' then 'selfida yuz aniqlanmadi'
                       else 'yuz namunaga mos kelmadi (o''xshashlik ' || greatest(0, round((1 - new.face_distance) * 100)) || '%)' end
                       || '. «Davomat» bo''limida selfini tekshiring.' end,
        array[(select f.photo_path from face_profiles f where f.member_id = new.member_id), new.check_in_selfie]);
    end if;
  end if;

  -- Ketish
  if tg_op = 'UPDATE' and new.check_out_at is not null and old.check_out_at is null and t.notify_checkout
     and not coalesce(new.check_out_auto, false) then
    v_time := to_char(new.check_out_at at time zone c.timezone, 'HH24:MI');
    v_msg := case v_lang
      when 'ru' then '🏁 ' || v_name || ' ушёл(ла) в ' || v_time
                     || case when new.early_leave_minutes > 0 then ' (раньше на ' || new.early_leave_minutes || ' мин)' else '' end
      when 'en' then '🏁 ' || v_name || ' checked out at ' || v_time
                     || case when new.early_leave_minutes > 0 then ' (' || new.early_leave_minutes || ' min early)' else '' end
      else '🏁 ' || v_name || ' ketdi: ' || v_time
                     || case when new.early_leave_minutes > 0 then ' (' || new.early_leave_minutes || ' daqiqa erta)' else '' end end;
    perform tg_send(new.company_id, v_msg);
  end if;
  return new;
exception when others then
  raise warning 'attendance_notify: %', sqlerrm;
  return new;
end $$;
drop trigger if exists attendance_notify_trg on public.attendance;
create trigger attendance_notify_trg after insert or update of check_in_at, check_out_at on public.attendance
  for each row execute function public.attendance_notify();

-- Yangi xodim ro'yxatdan o'tib, tasdiq kutayotganda guruhga xabar
create or replace function public.member_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare t company_telegram; c companies; v_who text;
begin
  if new.status <> 'pending' then return new; end if;
  select * into t from company_telegram where company_id = new.company_id;
  if t.company_id is null or not t.enabled or not t.notify_new_member then return new; end if;
  select * into c from companies where id = new.company_id;
  v_who := new.full_name || coalesce(', ' || new.phone, '') || coalesce(', ' || new.email, '');
  perform tg_send(new.company_id, case c.default_lang
    when 'ru' then '🆕 Новый сотрудник ждёт подтверждения: ' || v_who || E'\nПодтвердите в разделе «Сотрудники».'
    when 'en' then '🆕 New employee is waiting for approval: ' || v_who || E'\nApprove under Employees.'
    else '🆕 Yangi xodim tasdiq kutmoqda: ' || v_who || E'\n«Xodimlar» bo''limida tasdiqlang.' end);
  return new;
exception when others then
  raise warning 'member_notify: %', sqlerrm;
  return new;
end $$;
drop trigger if exists member_notify_trg on public.members;
create trigger member_notify_trg after insert on public.members
  for each row execute function public.member_notify();

create or replace function public.telegram_test() returns void
language plpgsql security definer set search_path = public as $$
declare c companies;
begin
  if not is_admin() then raise exception 'FORBIDDEN'; end if;
  select * into c from companies where id = my_company_id();
  perform tg_send(c.id, case c.default_lang
    when 'ru' then '🔔 Тестовое сообщение KPI-системы: «' || c.name || '». Уведомления работают!'
    when 'en' then '🔔 KPI system test message for "' || c.name || '". Notifications are working!'
    else '🔔 KPI tizimi sinov xabari: «' || c.name || '». Xabarnomalar ishlayapti!' end);
end $$;

-- Har kuni belgilangan vaqtda "hali kelmaganlar" ro'yxati (pg_cron har 10 daqiqada chaqiradi)
create or replace function public.send_daily_summaries() returns void
language plpgsql security definer set search_path = public as $$
declare
  r record; v_local timestamp; v_date date; v_list text; v_cnt int; v_total int; v_came int;
begin
  for r in
    select c.*, t.summary_time, t.last_summary_date
      from companies c join company_telegram t on t.company_id = c.id
     where t.enabled and t.daily_summary and coalesce(t.bot_token, '') <> '' and coalesce(t.chat_id, '') <> ''
  loop
    v_local := now() at time zone r.timezone;
    v_date := v_local::date;
    continue when v_local::time < r.summary_time;
    continue when r.last_summary_date is not null and r.last_summary_date >= v_date;
    update company_telegram set last_summary_date = v_date where company_id = r.id;
    continue when exists (select 1 from holidays where company_id = r.id and day = v_date);

    with exp as (
      select m.id, m.full_name from members m join member_schedule s on s.member_id = m.id
       where m.company_id = r.id and m.status = 'active' and m.track_attendance and m.start_date <= v_date
         and extract(isodow from v_date)::int = any(s.work_days)
    )
    select count(*),
           count(*) filter (where a.check_in_at is not null),
           count(*) filter (where a.check_in_at is null and coalesce(a.status, '') <> 'excused'),
           string_agg(exp.full_name, E'\n• ' order by exp.full_name)
             filter (where a.check_in_at is null and coalesce(a.status, '') <> 'excused')
      into v_total, v_came, v_cnt, v_list
      from exp left join attendance a on a.member_id = exp.id and a.work_date = v_date;

    continue when v_total = 0;
    perform tg_send(r.id, case r.default_lang
      when 'ru' then '📋 ' || to_char(v_local, 'DD.MM.YYYY HH24:MI') || E'\nПришли: ' || v_came || ' / ' || v_total
                     || case when v_cnt > 0 then E'\nЕщё не пришли (' || v_cnt || E'):\n• ' || v_list else E'\nВсе на месте 👍' end
      when 'en' then '📋 ' || to_char(v_local, 'DD.MM.YYYY HH24:MI') || E'\nChecked in: ' || v_came || ' / ' || v_total
                     || case when v_cnt > 0 then E'\nNot yet here (' || v_cnt || E'):\n• ' || v_list else E'\nEveryone is here 👍' end
      else '📋 ' || to_char(v_local, 'DD.MM.YYYY HH24:MI') || E'\nKelganlar: ' || v_came || ' / ' || v_total
                     || case when v_cnt > 0 then E'\nHali kelmaganlar (' || v_cnt || E'):\n• ' || v_list else E'\nHamma joyida 👍' end
      end);
  end loop;
end $$;
revoke execute on function public.send_daily_summaries() from public, anon, authenticated;

-- =====================================================================
--  STORAGE: selfi rasmlari (yopiq bucket)
--  Yo'l formati: <company_id>/<user_id>/<fayl>.jpg
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('selfies', 'selfies', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists selfies_insert on storage.objects;
create policy selfies_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'selfies'
              and (storage.foldername(name))[1] = public.my_company_id_any()::text
              and (storage.foldername(name))[2] = auth.uid()::text);

drop policy if exists selfies_select on storage.objects;
create policy selfies_select on storage.objects for select to authenticated
  using (bucket_id = 'selfies'
         and ((storage.foldername(name))[2] = auth.uid()::text
              or ((storage.foldername(name))[1] = public.my_company_id()::text and public.is_admin())));

-- =====================================================================
--  RUXSATLAR
-- =====================================================================

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.member_schedule to authenticated;
grant execute on all functions in schema public to authenticated;
-- tg-photo server funksiyasi (service_role) uchun minimal ruxsatlar
grant select, update on public.tg_outbox to service_role;
grant select on public.company_telegram to service_role;

-- Ichki funksiyalar foydalanuvchiga yopiq
revoke execute on function public.tg_send(uuid, text) from public, anon, authenticated;
revoke execute on function public.send_daily_summaries() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.run_checkout_tasks() from public, anon, authenticated;
revoke execute on function public.platform_notify_company(uuid) from public, anon, authenticated;

-- Ro'yxatdan o'tish sahifasi kodni tekshira olishi uchun
revoke execute on function public.check_join_code(text) from public;
grant execute on function public.check_join_code(text) to anon, authenticated;

-- =====================================================================
--  KUNLIK TELEGRAM HISOBOTI UCHUN JADVAL (pg_cron)
--  Agar xato bersa: Dashboard → Database → Extensions → "pg_cron" ni yoqing va shu blokni qayta ishga tushiring.
-- =====================================================================
do $$ begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'kpi-daily-summary';
  perform cron.schedule('kpi-daily-summary', '*/10 * * * *', 'select public.send_daily_summaries()');
  perform cron.unschedule(jobid) from cron.job where jobname = 'kpi-checkout-tasks';
  perform cron.schedule('kpi-checkout-tasks', '*/10 * * * *', 'select public.run_checkout_tasks()');
exception when others then
  raise notice 'pg_cron sozlanmadi: %', sqlerrm;
end $$;

-- PostgREST (API) funksiyalar ro'yxatini yangilasin
notify pgrst, 'reload schema';
