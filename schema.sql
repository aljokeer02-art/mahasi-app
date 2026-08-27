-- ============================================================
-- نظام المحاسبة الشخصية العائلية - إعداد قاعدة البيانات
-- منصة: Supabase (PostgreSQL)
-- طريقة الاستخدام: انسخ هذا الملف كاملاً والصقه في
-- Supabase Dashboard > SQL Editor > New query > Run
-- ============================================================

-- تفعيل الإضافات المطلوبة
create extension if not exists "pgcrypto";

-- ============================================================
-- 1) المؤسسات / مساحات العمل (كل عائلة = مساحة واحدة)
-- ============================================================
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users(id) not null,
  created_at timestamptz default now()
);

-- ============================================================
-- 2) أعضاء المؤسسة والصلاحيات
-- ============================================================
create type member_role as enum ('owner', 'editor', 'viewer');

create table org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null,
  user_id uuid references auth.users(id) not null,
  role member_role not null default 'viewer',
  joined_at timestamptz default now(),
  unique(org_id, user_id)
);

-- دالة مساعدة: هل المستخدم الحالي عضو في هذه المؤسسة؟ وما دوره؟
create or replace function get_user_role(p_org_id uuid)
returns member_role
language sql
security definer
stable
as $$
  select role from org_members
  where org_id = p_org_id and user_id = auth.uid()
  limit 1;
$$;

-- ============================================================
-- 3) العملات
-- ============================================================
create table currencies (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null,
  code text not null,          -- SAR, USD, EUR ...
  name text not null,
  symbol text,
  is_base boolean default false,
  exchange_rate numeric(18,6) default 1
);

-- ============================================================
-- 4) دليل الحسابات (Chart of Accounts)
-- ============================================================
create type account_category as enum ('اصول', 'خصوم', 'حقوق_ملكية', 'ايرادات', 'مصروفات');

create table accounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null,
  code text not null,
  name text not null,
  category account_category not null,
  parent_id uuid references accounts(id),
  currency_id uuid references currencies(id),
  opening_balance numeric(18,2) default 0,
  is_active boolean default true,
  created_at timestamptz default now(),
  deleted_at timestamptz          -- حذف ناعم
);

-- ============================================================
-- 5) العملاء والموردون
-- ============================================================
create type contact_type as enum ('عميل', 'مورد', 'كلاهما');

create table contacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null,
  name text not null,
  type contact_type not null,
  phone text,
  email text,
  notes text,
  created_at timestamptz default now(),
  deleted_at timestamptz
);

-- ============================================================
-- 6) القيود المحاسبية (رأس القيد)
-- ============================================================
create type entry_status as enum ('مسودة', 'مرحل', 'ملغى');

create table journal_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null,
  entry_number serial,
  entry_date date not null default current_date,
  description text,
  status entry_status not null default 'مسودة',
  created_by uuid references auth.users(id) not null,
  created_at timestamptz default now(),
  deleted_at timestamptz
);

-- ============================================================
-- 7) سطور القيد (تفاصيل المدين والدائن)
-- ============================================================
create table journal_lines (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid references journal_entries(id) on delete cascade not null,
  account_id uuid references accounts(id) not null,
  contact_id uuid references contacts(id),
  debit numeric(18,2) default 0,
  credit numeric(18,2) default 0,
  description text,
  check (debit >= 0 and credit >= 0),
  check (not (debit > 0 and credit > 0))  -- السطر إما مدين أو دائن، ليس كلاهما
);

-- ============================================================
-- 8) الصناديق والبنوك
-- ============================================================
create type cash_bank_type as enum ('نقدي', 'بنك');

create table cash_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null,
  account_id uuid references accounts(id) not null,
  type cash_bank_type not null,
  bank_name text,
  account_number text
);

-- ============================================================
-- 9) الديون والأصول
-- ============================================================
create type debt_asset_type as enum ('دين_علي', 'دين_لي', 'اصل');

create table debts_assets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null,
  type debt_asset_type not null,
  name text not null,
  amount numeric(18,2) not null,
  contact_id uuid references contacts(id),
  due_date date,
  status text default 'قائم',
  created_at timestamptz default now()
);

-- ============================================================
-- 10) المرفقات (صور الفواتير والإيصالات)
-- ============================================================
create table attachments (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid references journal_entries(id) on delete cascade,
  file_url text not null,
  uploaded_by uuid references auth.users(id),
  uploaded_at timestamptz default now()
);

-- ============================================================
-- 11) سجل التدقيق (Audit Log)
-- ============================================================
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null,
  user_id uuid references auth.users(id),
  action text not null,        -- create / update / delete
  table_name text not null,
  record_id uuid,
  details jsonb,
  created_at timestamptz default now()
);

-- ============================================================
-- 12) دالة: التأكد من توازن القيد (مدين = دائن) قبل الترحيل
-- ============================================================
create or replace function check_entry_balanced()
returns trigger
language plpgsql
as $$
declare
  total_debit numeric(18,2);
  total_credit numeric(18,2);
begin
  if (select status from journal_entries where id = new.id) = 'مرحل' then
    select coalesce(sum(debit),0), coalesce(sum(credit),0)
    into total_debit, total_credit
    from journal_lines where entry_id = new.id;

    if total_debit <> total_credit then
      raise exception 'القيد غير متوازن: مدين % لا يساوي دائن %', total_debit, total_credit;
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_check_balanced
before update on journal_entries
for each row
when (new.status = 'مرحل')
execute function check_entry_balanced();

-- ============================================================
-- 13) تفعيل الحماية على مستوى الصف (RLS) - عزل بيانات كل عائلة
-- ============================================================
alter table organizations enable row level security;
alter table org_members enable row level security;
alter table currencies enable row level security;
alter table accounts enable row level security;
alter table contacts enable row level security;
alter table journal_entries enable row level security;
alter table journal_lines enable row level security;
alter table cash_bank_accounts enable row level security;
alter table debts_assets enable row level security;
alter table attachments enable row level security;
alter table audit_log enable row level security;

-- سياسة عامة: يمكن للمستخدم رؤية سجلات مؤسسته فقط
create policy "read own org" on organizations for select
  using (id in (select org_id from org_members where user_id = auth.uid()));

create policy "read own members" on org_members for select
  using (org_id in (select org_id from org_members where user_id = auth.uid()));

create policy "read own accounts" on accounts for select
  using (org_id in (select org_id from org_members where user_id = auth.uid()));

create policy "editors write accounts" on accounts for insert
  with check (get_user_role(org_id) in ('owner','editor'));

create policy "editors update accounts" on accounts for update
  using (get_user_role(org_id) in ('owner','editor'));

create policy "read own contacts" on contacts for select
  using (org_id in (select org_id from org_members where user_id = auth.uid()));

create policy "editors write contacts" on contacts for insert
  with check (get_user_role(org_id) in ('owner','editor'));

create policy "read own entries" on journal_entries for select
  using (org_id in (select org_id from org_members where user_id = auth.uid()));

create policy "editors write entries" on journal_entries for insert
  with check (get_user_role(org_id) in ('owner','editor'));

create policy "editors update entries" on journal_entries for update
  using (get_user_role(org_id) in ('owner','editor'));

create policy "read own lines" on journal_lines for select
  using (entry_id in (
    select id from journal_entries where org_id in
    (select org_id from org_members where user_id = auth.uid())
  ));

create policy "editors write lines" on journal_lines for insert
  with check (entry_id in (
    select id from journal_entries where get_user_role(org_id) in ('owner','editor')
  ));

create policy "read own currencies" on currencies for select
  using (org_id in (select org_id from org_members where user_id = auth.uid()));

create policy "read own cash_bank" on cash_bank_accounts for select
  using (org_id in (select org_id from org_members where user_id = auth.uid()));

create policy "read own debts_assets" on debts_assets for select
  using (org_id in (select org_id from org_members where user_id = auth.uid()));

create policy "read own audit_log" on audit_log for select
  using (org_id in (select org_id from org_members where user_id = auth.uid()));

-- ============================================================
-- 14) عند إنشاء أول مؤسسة، المنشئ يصبح owner تلقائياً
-- ============================================================
create or replace function add_owner_on_org_create()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into org_members (org_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;

create trigger trg_add_owner
after insert on organizations
for each row
execute function add_owner_on_org_create();

-- ============================================================
-- تم! نفّذ هذا الملف كاملاً في Supabase SQL Editor مرة واحدة.
-- ============================================================
