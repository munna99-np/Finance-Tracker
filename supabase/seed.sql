-- NOTE:
-- Seeding with auth.uid() in SQL Editor returns NULL and breaks FK to profiles.
-- Use a fixed seed user ID, ensure a profile row exists, and simulate JWT claims
-- so RLS policies with auth.uid() pass during inserts.

-- Fixed seed user
-- You can change this to your real auth.users UUID if desired
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

-- Ensure profile exists for the seed user (FK target)
insert into profiles (id, full_name)
values ('00000000-0000-0000-0000-000000000001', 'Seed User')
on conflict (id) do nothing;

-- Seed categories
insert into categories (id, name, scope, owner)
select gen_random_uuid(), n, 'personal', '00000000-0000-0000-0000-000000000001'::uuid from (values
  ('lodging/fooding'), ('rent'), ('utilities'), ('daily expenses'), ('bike'), ('entertainment'), ('subscriptions')
) t(n);

insert into categories (id, name, scope, owner)
select gen_random_uuid(), n, 'work', '00000000-0000-0000-0000-000000000001'::uuid from (values
  ('loan'), ('sapati'), ('bills'), ('salary')
) t(n);

-- Sample parties
insert into parties (id, name, phone, owner)
values (gen_random_uuid(), 'Ramesh', '9800000001', '00000000-0000-0000-0000-000000000001'::uuid),
       (gen_random_uuid(), 'Sita Traders', '9800000002', '00000000-0000-0000-0000-000000000001'::uuid);

-- Sample accounts
insert into accounts (id, name, kind, opening_balance, owner)
values (gen_random_uuid(), 'Personal Wallet', 'personal', 5000, '00000000-0000-0000-0000-000000000001'::uuid),
       (gen_random_uuid(), 'Company Bank', 'company', 100000, '00000000-0000-0000-0000-000000000001'::uuid);

-- Demo transactions (assumes account/category/party IDs exist; adjust in UI if needed)
-- These are illustrative; you can add via the app for accurate references.

-- Inventory demo data (optional)
-- Categories/Subcategories/Items for Inventory page
insert into inventory_categories (name) values
  ('Electronics') on conflict (name) do nothing;
insert into inventory_categories (name) values
  ('Groceries') on conflict (name) do nothing;

-- Fetch category ids
with c as (
  select id from inventory_categories where name = 'Electronics'
), g as (
  select id from inventory_categories where name = 'Groceries'
)
insert into inventory_subcategories (category_id, name)
select c.id, n from c, (values ('Mobiles'),('Laptops')) v(n)
on conflict (category_id, name) do nothing;

with g as (
  select id from inventory_categories where name = 'Groceries'
)
insert into inventory_subcategories (category_id, name)
select g.id, n from g, (values ('Snacks'),('Beverages')) v(n)
on conflict (category_id, name) do nothing;

-- Items
insert into inventory_items (subcategory_id, name, sku, unit, price, stock, min_stock)
select s.id, n, sku, 'pcs', price, 0, 5
from inventory_subcategories s
join (
  values
    ('Mobiles','IP15','iPhone 15',1200.00),
    ('Mobiles','SM23','Samsung S23',900.00),
    ('Laptops','DLV15','Dell Vostro 15',650.00),
    ('Snacks','CHPS01','Potato Chips',1.50),
    ('Beverages','COKE01','Coke 500ml',0.99)
) as t(subname, sku, n, price)
  on t.subname = (select name from inventory_subcategories where id = s.id)
on conflict (subcategory_id, name) do nothing;

-- Sample staff (uses fixed seed user id above)
insert into staff (id, name, phone, role, joined_on, owner)
select gen_random_uuid(), name, phone, role, joined_on, '00000000-0000-0000-0000-000000000001'::uuid
from (values
  ('Floyd Miles', '9800000003', 'Sales', '2024-01-10'::date),
  ('Annette Black', '9800000004', 'Accounts', '2024-02-15'::date)
) s(name, phone, role, joined_on);

-- Optional examples of related records (commented out; fill staff ids as needed)
-- insert into staff_advances (staff_id, date, amount, notes)
-- values ('<staff-id>', '2024-04-05', 1000, 'Travel advance');
-- insert into staff_salaries (staff_id, period, amount, paid_on, notes)
-- values ('<staff-id>', '2024-04-01', 35000, '2024-04-30', 'Monthly salary');
