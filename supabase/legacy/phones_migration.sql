-- Run once in the Supabase SQL editor (after schema.sql).
alter table products add column if not exists brand text not null default '';
alter table products add column if not exists specs text not null default '';
alter table products add column if not exists image_url text;
alter table products add column if not exists active boolean not null default true;

drop policy if exists "products are public" on products;
create policy "active products are public" on products for select using (active);

-- Retire the old ceramics samples (hidden if they were ordered, deleted otherwise)
update products set active = false where name in ('Tide bowl','Ink mug','Ash vase','Salt pinch pot');
delete from products where name in ('Tide bowl','Ink mug','Ash vase','Salt pinch pot')
  and id not in (select product_id from order_items);

-- Sample phones (placeholder prices in kobo: 115000000 = ₦1,150,000)
insert into products (name, brand, specs, description, price_cents, color) values
 ('iPhone 15', 'Apple', '6.1" · 128GB · 6GB RAM', 'Dual camera, USB-C, A16 chip.', 115000000, '#2F3B4C'),
 ('Galaxy S24', 'Samsung', '6.2" · 256GB · 8GB RAM', 'AMOLED 120Hz display, 50MP camera.', 125000000, '#7B6FA8'),
 ('Pixel 8', 'Google', '6.2" · 128GB · 8GB RAM', 'Clean Android with long update support.', 85000000, '#5E8C7B'),
 ('Camon 30', 'Tecno', '6.78" · 256GB · 8GB RAM', '50MP OIS camera, fast charging.', 28000000, '#C98B3C'),
 ('Note 40', 'Infinix', '6.78" · 256GB · 8GB RAM', '120Hz AMOLED, 45W charging.', 23000000, '#3F6FB5'),
 ('Redmi Note 13', 'Xiaomi', '6.67" · 128GB · 6GB RAM', '108MP camera, AMOLED display.', 26000000, '#B5483F');
