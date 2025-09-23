-- Extensions
create extension if not exists pgcrypto;

-- Profiles
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);

-- Accounts
create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('personal','company')),
  opening_balance numeric(14,2) not null default 0,
  is_active boolean not null default true,
  owner uuid not null default auth.uid() references profiles(id) on delete cascade,
  unique (owner, name)
);

-- Parties
create table if not exists parties (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  phone text,
  notes text,
  owner uuid not null default auth.uid() references profiles(id) on delete cascade
);

-- Categories
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  scope text not null check (scope in ('personal','work')),
  parent_id uuid references categories(id),
  owner uuid not null default auth.uid() references profiles(id) on delete cascade,
  unique (owner, scope, name)
);

-- Transactions
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id),
  date date not null,
  amount numeric(14,2) not null,
  qty numeric(14,3),
  direction text not null check (direction in ('in','out','transfer')),
  scope text not null check (scope in ('personal','work')),
  mode text,
  category_id uuid references categories(id),
  party_id uuid references parties(id),
  notes text,
  created_at timestamptz not null default now(),
  owner uuid not null default auth.uid() references profiles(id) on delete cascade
);

create index if not exists idx_tx_owner_date on transactions(owner, date);
create index if not exists idx_tx_owner_category on transactions(owner, category_id);
create index if not exists idx_tx_owner_party on transactions(owner, party_id);
create index if not exists idx_tx_owner_account on transactions(owner, account_id);

-- Transfers
create table if not exists transfers (
  id uuid primary key default gen_random_uuid(),
  from_account uuid not null references accounts(id),
  to_account uuid not null references accounts(id),
  date date not null,
  amount numeric(14,2) not null,
  notes text,
  owner uuid not null default auth.uid() references profiles(id) on delete cascade
);

-- RLS
alter table profiles enable row level security;
alter table accounts enable row level security;
alter table parties enable row level security;
alter table categories enable row level security;
alter table transactions enable row level security;
alter table transfers enable row level security;

-- Policies: CRUD where owner = auth.uid()
create policy sel_profiles_self on profiles for select using (id = auth.uid());
create policy upd_profiles_self on profiles for update using (id = auth.uid());

create policy sel_accounts_owner on accounts for select using (owner = auth.uid());
create policy ins_accounts_owner on accounts for insert with check (owner = auth.uid());
create policy upd_accounts_owner on accounts for update using (owner = auth.uid());
create policy del_accounts_owner on accounts for delete using (owner = auth.uid());

create policy sel_parties_owner on parties for select using (owner = auth.uid());
create policy ins_parties_owner on parties for insert with check (owner = auth.uid());
create policy upd_parties_owner on parties for update using (owner = auth.uid());
create policy del_parties_owner on parties for delete using (owner = auth.uid());

create policy sel_categories_owner on categories for select using (owner = auth.uid());
create policy ins_categories_owner on categories for insert with check (owner = auth.uid());
create policy upd_categories_owner on categories for update using (owner = auth.uid());
create policy del_categories_owner on categories for delete using (owner = auth.uid());

create policy sel_transactions_owner on transactions for select using (owner = auth.uid());
create policy ins_transactions_owner on transactions for insert with check (owner = auth.uid());
create policy upd_transactions_owner on transactions for update using (owner = auth.uid());
create policy del_transactions_owner on transactions for delete using (owner = auth.uid());

create policy sel_transfers_owner on transfers for select using (owner = auth.uid());
create policy ins_transfers_owner on transfers for insert with check (owner = auth.uid());
create policy upd_transfers_owner on transfers for update using (owner = auth.uid());
  create policy del_transfers_owner on transfers for delete using (owner = auth.uid());

-- On auth signup, create profile row
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =========================
-- Inventory schema (categories, subcategories, items, purchases)
-- Create only if missing
-- =========================

create table if not exists inventory_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz default now()
);

create table if not exists inventory_subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references inventory_categories(id) on delete cascade,
  name text not null,
  created_at timestamptz default now(),
  unique (category_id, name)
);

create table if not exists inventory_items (
  id uuid primary key default gen_random_uuid(),
  subcategory_id uuid not null references inventory_subcategories(id) on delete cascade,
  name text not null,
  sku text unique,
  unit text default 'pcs',
  price numeric(12,2) default 0,
  stock numeric(14,3) default 0,
  min_stock numeric(14,3) default 0,
  max_stock numeric(14,3) default 0,
  notes text,
  created_at timestamptz default now(),
  unique (subcategory_id, name)
);

create table if not exists inventory_purchases (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references parties(id) on delete restrict,
  invoice_no text,
  purchase_date date not null default current_date,
  payment_type text check (payment_type in ('cash','credit','bank')),
  discount numeric(14,2) default 0,
  tax_amount numeric(14,2) default 0,
  notes text,
  total_amount numeric(14,2) default 0,
  created_at timestamptz default now()
);

create table if not exists inventory_purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references inventory_purchases(id) on delete cascade,
  item_id uuid not null references inventory_items(id) on delete restrict,
  qty numeric(14,3) not null check (qty > 0),
  rate numeric(12,2) not null check (rate >= 0),
  amount numeric(14,2) generated always as (qty * rate) stored,
  unique (purchase_id, item_id)
);

-- Stock adjustment triggers
create or replace function public.fn_inventory_adjust_stock() returns trigger as $$
begin
  if tg_op = 'INSERT' then
    update inventory_items set stock = coalesce(stock,0) + new.qty where id = new.item_id;
    return new;
  elsif tg_op = 'UPDATE' then
    update inventory_items set stock = coalesce(stock,0) + (new.qty - old.qty) where id = new.item_id;
    return new;
  elsif tg_op = 'DELETE' then
    update inventory_items set stock = coalesce(stock,0) - old.qty where id = old.item_id;
    return old;
  end if;
  return null;
end;
$$ language plpgsql;

drop trigger if exists trg_inv_pi_ins on inventory_purchase_items;
create trigger trg_inv_pi_ins after insert on inventory_purchase_items
for each row execute procedure public.fn_inventory_adjust_stock();

drop trigger if exists trg_inv_pi_upd on inventory_purchase_items;
create trigger trg_inv_pi_upd after update of qty on inventory_purchase_items
for each row execute procedure public.fn_inventory_adjust_stock();

drop trigger if exists trg_inv_pi_del on inventory_purchase_items;
create trigger trg_inv_pi_del after delete on inventory_purchase_items
for each row execute procedure public.fn_inventory_adjust_stock();

-- Optional: simple RLS to allow authenticated users
alter table inventory_categories enable row level security;
alter table inventory_subcategories enable row level security;
alter table inventory_items enable row level security;
alter table inventory_purchases enable row level security;
alter table inventory_purchase_items enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where polname = 'rls_all_inv_categories'
  ) then
    create policy rls_all_inv_categories on inventory_categories for all to authenticated using (true) with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where polname = 'rls_all_inv_subcategories'
  ) then
    create policy rls_all_inv_subcategories on inventory_subcategories for all to authenticated using (true) with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where polname = 'rls_all_inv_items'
  ) then
    create policy rls_all_inv_items on inventory_items for all to authenticated using (true) with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where polname = 'rls_all_inv_purchases'
  ) then
    create policy rls_all_inv_purchases on inventory_purchases for all to authenticated using (true) with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where polname = 'rls_all_inv_purchase_items'
  ) then
    create policy rls_all_inv_purchase_items on inventory_purchase_items for all to authenticated using (true) with check (true);
  end if;
end $$;

-- Staff/Employees
create table if not exists staff (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  role text,
  joined_on date,
  owner uuid not null default auth.uid() references profiles(id) on delete cascade
);

create table if not exists staff_advances (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff(id) on delete cascade,
  date date not null,
  amount numeric(14,2) not null check (amount > 0),
  notes text,
  owner uuid not null default auth.uid() references profiles(id) on delete cascade
);
create index if not exists idx_staff_adv_owner_date on staff_advances(owner, date);
create index if not exists idx_staff_adv_staff on staff_advances(staff_id);

create table if not exists staff_salaries (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff(id) on delete cascade,
  period date not null, -- use first day of month
  amount numeric(14,2) not null check (amount >= 0),
  paid_on date,
  notes text,
  owner uuid not null default auth.uid() references profiles(id) on delete cascade,
  unique (owner, staff_id, period)
);
create index if not exists idx_staff_sal_owner_period on staff_salaries(owner, period);
create index if not exists idx_staff_sal_staff on staff_salaries(staff_id);

create table if not exists staff_attendance (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff(id) on delete cascade,
  date date not null,
  status text not null check (status in ('present','absent','leave')),
  notes text,
  owner uuid not null default auth.uid() references profiles(id) on delete cascade,
  unique (owner, staff_id, date)
);
create index if not exists idx_staff_att_owner_date on staff_attendance(owner, date);
create index if not exists idx_staff_att_staff on staff_attendance(staff_id);

-- RLS
alter table staff enable row level security;
alter table staff_advances enable row level security;
alter table staff_salaries enable row level security;
alter table staff_attendance enable row level security;

-- Policies
create policy sel_staff_owner on staff for select using (owner = auth.uid());
create policy ins_staff_owner on staff for insert with check (owner = auth.uid());
create policy upd_staff_owner on staff for update using (owner = auth.uid());
create policy del_staff_owner on staff for delete using (owner = auth.uid());

create policy sel_staff_adv_owner on staff_advances for select using (owner = auth.uid());
create policy ins_staff_adv_owner on staff_advances for insert with check (owner = auth.uid());
create policy upd_staff_adv_owner on staff_advances for update using (owner = auth.uid());
create policy del_staff_adv_owner on staff_advances for delete using (owner = auth.uid());

create policy sel_staff_sal_owner on staff_salaries for select using (owner = auth.uid());
create policy ins_staff_sal_owner on staff_salaries for insert with check (owner = auth.uid());
create policy upd_staff_sal_owner on staff_salaries for update using (owner = auth.uid());
create policy del_staff_sal_owner on staff_salaries for delete using (owner = auth.uid());

create policy sel_staff_att_owner on staff_attendance for select using (owner = auth.uid());

create policy ins_staff_att_owner on staff_attendance for insert with check (owner = auth.uid());

create policy upd_staff_att_owner on staff_attendance for update using (owner = auth.uid());

create policy del_staff_att_owner on staff_attendance for delete using (owner = auth.uid());
