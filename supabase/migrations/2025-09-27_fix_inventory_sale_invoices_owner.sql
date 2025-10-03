-- Fix owner handling for inventory_sale_invoices and repair related policies

-- Ensure owner column exists and is enforced
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'inventory_sale_invoices' and column_name = 'owner'
  ) then
    alter table inventory_sale_invoices add column owner uuid;
  end if;
end $$;

-- Backfill owner for legacy rows (assign an existing profile when possible)
with fallback as (
  select id from profiles order by created_at asc limit 1
)
update inventory_sale_invoices isi
set owner = fallback.id
from fallback
where isi.owner is null and fallback.id is not null;

-- Ensure FK and default are applied
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'inventory_sale_invoices_owner_fkey'
  ) then
    alter table inventory_sale_invoices
      add constraint inventory_sale_invoices_owner_fkey
      foreign key (owner) references profiles(id) on delete cascade;
  end if;
end $$;

alter table inventory_sale_invoices alter column owner set default auth.uid();
alter table inventory_sale_invoices alter column owner set not null;

-- Replace obsolete unique index and enforce per-owner uniqueness
do $$ begin
  if exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'idx_inventory_sale_invoices_invoice_no'
  ) then
    drop index idx_inventory_sale_invoices_invoice_no;
  end if;
end $$;

create unique index if not exists idx_inventory_sale_invoices_owner_invoice_no on inventory_sale_invoices(owner, invoice_no);
create index if not exists idx_inventory_sale_invoices_owner_date on inventory_sale_invoices(owner, invoice_date desc);

-- Align row level security policies
do $$ begin
  if exists (
    select 1 from pg_policies where polname = 'rls_all_inv_sale_invoices'
  ) then
    drop policy rls_all_inv_sale_invoices on inventory_sale_invoices;
  end if;
  if not exists (
    select 1 from pg_policies where polname = 'sel_inventory_sale_invoices_owner'
  ) then
    create policy sel_inventory_sale_invoices_owner on inventory_sale_invoices for select using (owner = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where polname = 'ins_inventory_sale_invoices_owner'
  ) then
    create policy ins_inventory_sale_invoices_owner on inventory_sale_invoices for insert with check (owner = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where polname = 'upd_inventory_sale_invoices_owner'
  ) then
    create policy upd_inventory_sale_invoices_owner on inventory_sale_invoices for update using (owner = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where polname = 'del_inventory_sale_invoices_owner'
  ) then
    create policy del_inventory_sale_invoices_owner on inventory_sale_invoices for delete using (owner = auth.uid());
  end if;
end $$;

-- Ensure every auth user has a profile row for FK integrity
insert into profiles (id, full_name)
select u.id, coalesce(u.raw_user_meta_data ->> 'full_name', '')
from auth.users u
where not exists (select 1 from profiles p where p.id = u.id);
