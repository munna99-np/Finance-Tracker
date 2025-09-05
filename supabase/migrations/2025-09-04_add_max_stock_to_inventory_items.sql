-- Add max_stock column to inventory_items if not exists
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'inventory_items' and column_name = 'max_stock'
  ) then
    alter table inventory_items add column max_stock numeric(14,3) default 0;
  end if;
end $$;

