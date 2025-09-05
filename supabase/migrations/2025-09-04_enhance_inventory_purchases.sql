-- Enhance inventory_purchases with payment/discount/tax/notes if missing
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'inventory_purchases' and column_name = 'payment_type'
  ) then
    alter table inventory_purchases add column payment_type text check (payment_type in ('cash','credit','bank'));
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'inventory_purchases' and column_name = 'discount'
  ) then
    alter table inventory_purchases add column discount numeric(14,2) default 0;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'inventory_purchases' and column_name = 'tax_amount'
  ) then
    alter table inventory_purchases add column tax_amount numeric(14,2) default 0;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'inventory_purchases' and column_name = 'notes'
  ) then
    alter table inventory_purchases add column notes text;
  end if;
end $$;

