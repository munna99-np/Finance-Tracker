-- Adds missing qty column to transactions if it doesn't already exist
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'transactions' and column_name = 'qty'
  ) then
    alter table public.transactions add column qty numeric(14,3);
  end if;
end $$;

