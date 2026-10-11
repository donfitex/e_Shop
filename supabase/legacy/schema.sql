create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  price_cents integer not null check (price_cents >= 0),
  color text not null default '#A9C5B5'
);
create table orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  email text not null,
  shipping jsonb not null,
  total_cents integer not null,
  email_sent boolean not null default false,
  created_at timestamptz not null default now()
);
create table order_items (
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
create policy "products are public" on products for select using (true);
create policy "own orders" on orders for select using (auth.uid() = user_id);
create policy "own order items" on order_items for select
  using (exists (select 1 from orders o where o.id = order_id and o.user_id = auth.uid()));
-- Writes happen only on the server with the service key (bypasses RLS).
insert into products (name, description, price_cents, color) values
 ('Tide bowl', 'Hand-thrown stoneware, 18 cm, celadon glaze.', 1800000, '#A9C5B5'),
 ('Ink mug', 'Deep blue glaze, 300 ml, thumb rest.', 1200000, '#1F2A44'),
 ('Ash vase', 'Matte grey, 24 cm, holds a single stem.', 3500000, '#9AA3A8'),
 ('Salt pinch pot', 'Small lidded pot for the counter.', 900000, '#E8D9B5');
