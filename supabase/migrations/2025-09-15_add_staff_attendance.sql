create table if not exists staff_attendance (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff(id) on delete cascade,
  date date not null,
  status text not null check (status in (''present'',''absent'',''leave'')),
  notes text,
  owner uuid not null default auth.uid() references profiles(id) on delete cascade,
  unique (owner, staff_id, date)
);

create index if not exists idx_staff_att_owner_date on staff_attendance(owner, date);
create index if not exists idx_staff_att_staff on staff_attendance(staff_id);

alter table staff_attendance enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where polname = ''sel_staff_att_owner'') then
    create policy sel_staff_att_owner on staff_attendance for select using (owner = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where polname = ''ins_staff_att_owner'') then
    create policy ins_staff_att_owner on staff_attendance for insert with check (owner = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where polname = ''upd_staff_att_owner'') then
    create policy upd_staff_att_owner on staff_attendance for update using (owner = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where polname = ''del_staff_att_owner'') then
    create policy del_staff_att_owner on staff_attendance for delete using (owner = auth.uid());
  end if;
end $$;
