-- Baseline of the R-Blink shop as of Stage 2. Safe to run on a fresh project AND on one
-- that already ran the three legacy files (everything is idempotent).
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  price_cents integer not null check (price_cents >= 0),
  color text not null default '#22352d',
  brand text not null default '',
  specs text not null default '',
  image_url text,
  images text[] not null default '{}',
  active boolean not null default true,
  stock integer not null default 10 check (stock >= 0)
);
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  email text not null,
  shipping jsonb not null,
  total_cents integer not null,
  email_sent boolean not null default false,
  status text not null default 'pending',
  payment_method text not null default 'cod',
  created_at timestamptz not null default now()
);
create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid not null references products(id),
  name text not null,
  unit_cents integer not null,
  qty integer not null check (qty > 0)
);

alter table products enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;

drop policy if exists "products are public" on products;
drop policy if exists "active products are public" on products;
create policy "active products are public" on products for select using (active);
drop policy if exists "own orders" on orders;
create policy "own orders" on orders for select using (auth.uid() = user_id);
drop policy if exists "own order items" on order_items;
create policy "own order items" on order_items for select
  using (exists (select 1 from orders o where o.id = order_id and o.user_id = auth.uid()));
-- Writes happen only on the server with the service key (bypasses RLS).

create or replace function decrement_stock(pid uuid, qty integer) returns void language sql as $$
  update products set stock = greatest(stock - qty, 0) where id = pid;
$$;
revoke execute on function decrement_stock(uuid, integer) from public, anon, authenticated;

insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true)
  on conflict (id) do nothing;

-- Sample phones (placeholder prices in kobo). Skipped if a phone with the same name exists.
insert into products (name, brand, specs, description, price_cents, color)
select * from (values
 ('iPhone 15', 'Apple', '6.1" · 128GB · 6GB RAM', 'Dual camera, USB-C, A16 chip.', 115000000, '#2F3B4C'),
 ('Galaxy S24', 'Samsung', '6.2" · 256GB · 8GB RAM', 'AMOLED 120Hz display, 50MP camera.', 125000000, '#7B6FA8'),
 ('Pixel 8', 'Google', '6.2" · 128GB · 8GB RAM', 'Clean Android with long update support.', 85000000, '#5E8C7B'),
 ('Camon 30', 'Tecno', '6.78" · 256GB · 8GB RAM', '50MP OIS camera, fast charging.', 28000000, '#C98B3C'),
 ('Note 40', 'Infinix', '6.78" · 256GB · 8GB RAM', '120Hz AMOLED, 45W charging.', 23000000, '#3F6FB5'),
 ('Redmi Note 13', 'Xiaomi', '6.67" · 128GB · 6GB RAM', '108MP camera, AMOLED display.', 26000000, '#B5483F')
) as v(name, brand, specs, description, price_cents, color)
where not exists (select 1 from products p where p.name = v.name);
