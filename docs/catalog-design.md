# Catalogue design: categories, attributes, variants

## Decision: how to store category-specific fields
| Option | Pros | Cons |
|--------|------|------|
| One column per field | Fast, typed | New category = schema change; table fills with empty columns |
| EAV (one row per value) | Flexible | Slow, awkward filter queries |
| **JSONB values + attribute definitions table (chosen)** | New fields with no migration; GIN-indexable; validated by the server against definitions | Needs careful server validation; heavy filters may later be promoted to real columns |

## Tables (additive; nothing existing is dropped)
```sql
categories(id uuid pk, parent_id uuid null references categories, slug text unique,
           name text, description text, image_url text, sort_order int, active bool, path text)  -- path e.g. 'electronics/phones'
attribute_definitions(id uuid pk, category_id uuid references categories, key text, label text,
           type text check (type in ('text','number','boolean','select','multiselect','measure','date')),
           unit text null, options jsonb null, is_filterable bool, is_required bool, sort_order int,
           unique (category_id, key))
products  + category_id, slug, sku, product_type, condition, attributes jsonb default '{}',
            published bool, currency text default 'NGN'
product_variants(id uuid pk, product_id uuid references products, sku text unique, price_cents int,
            compare_at_cents int null, currency text, stock int check (stock >= 0),
            option_values jsonb, active bool)            -- e.g. {"size":"42","colour":"Black"}
inventory_movements(id, variant_id, delta int, reason text, order_id null, actor uuid, created_at)
order_items  + variant_id, sku, option_values (snapshot)
```
Attributes that differ per variant (size, colour, storage) live on the variant; shared specs (material, screen size) live on the product.

## Inheritance
A child category uses its own definitions plus its ancestors' (found with a recursive query on `parent_id`). Example: "Fashion" defines brand and material; "Shoes" adds shoe size and type.

## Validation (server side, every write)
- Keys must exist in the category's definitions; unknown keys are rejected.
- `number` and `measure` must be numeric; `select` values must be in `options`; required keys must be present.
- Filterable keys are the only ones the search API accepts.

## Launch category tree (starter, editable by admin)
- Mobile phones: brand, storage, RAM, screen size, OS, colour (variant: storage, colour)
- Electronics accessories: chargers and cables, power banks, earbuds: brand, connector type, capacity, colour
- Fashion: men, women, children; shoes: brand, material, colour, size (variant), fit
- Home & Kitchen: cookware, small appliances, storage: brand, material, capacity, colour, power

## Migration plan for existing phones
1. Create the new tables and the "Mobile phones" category.
2. For each product: set `category_id`, copy `brand` and `specs` into `attributes`, create one default variant holding its current price and stock.
3. Keep old columns until every screen reads the new ones; remove later in a separate migration.
4. Back up first (Supabase dashboard backup or `pg_dump`); test on a copy; verify product, order and stock counts match before and after.
