-- Ensure inventory_party_ledger entries are scoped to owners and RLS enforces it

-- Add owner column when missing
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'inventory_party_ledger' and column_name = 'owner'
  ) then
    alter table inventory_party_ledger add column owner uuid;
  end if;
end $$;

-- Backfill owner from related party or fallback profile
update inventory_party_ledger l
set owner = p.owner
from parties p
where l.party_id = p.id and l.owner is null and p.owner is not null;

with fallback as (
  select id from profiles order by created_at asc limit 1
)
update inventory_party_ledger l
set owner = fallback.id
from fallback
where l.owner is null and fallback.id is not null;

-- Enforce FK and defaults
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'inventory_party_ledger_owner_fkey'
  ) then
    alter table inventory_party_ledger
      add constraint inventory_party_ledger_owner_fkey
      foreign key (owner) references profiles(id) on delete cascade;
  end if;
end $$;

alter table inventory_party_ledger alter column owner set default auth.uid();
alter table inventory_party_ledger alter column owner set not null;

-- Helpful index for owner scoped queries
create index if not exists idx_inventory_party_ledger_owner_date on inventory_party_ledger(owner, entry_date desc);

-- Align row level security policies
do $$ begin
  if exists (
    select 1 from pg_policies where polname = 'rls_all_inv_party_ledger'
  ) then
    drop policy rls_all_inv_party_ledger on inventory_party_ledger;
  end if;
  if not exists (
    select 1 from pg_policies where polname = 'sel_inventory_party_ledger_owner'
  ) then
    create policy sel_inventory_party_ledger_owner on inventory_party_ledger for select using (owner = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where polname = 'ins_inventory_party_ledger_owner'
  ) then
    create policy ins_inventory_party_ledger_owner on inventory_party_ledger for insert with check (owner = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where polname = 'upd_inventory_party_ledger_owner'
  ) then
    create policy upd_inventory_party_ledger_owner on inventory_party_ledger for update using (owner = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where polname = 'del_inventory_party_ledger_owner'
  ) then
    create policy del_inventory_party_ledger_owner on inventory_party_ledger for delete using (owner = auth.uid());
  end if;
end $$;
