-- Run once in the Supabase SQL editor (after schema.sql and phones_migration.sql).
alter table products add column if not exists stock integer not null default 10 check (stock >= 0);
alter table products add column if not exists images text[] not null default '{}';
update products set images = array[image_url] where image_url is not null and cardinality(images) = 0;

alter table orders add column if not exists status text not null default 'pending';
alter table orders add column if not exists payment_method text not null default 'cod';

create or replace function decrement_stock(pid uuid, qty integer) returns void language sql as $$
  update products set stock = greatest(stock - qty, 0) where id = pid;
$$;
revoke execute on function decrement_stock(uuid, integer) from public, anon, authenticated;

insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true)
  on conflict (id) do nothing;
