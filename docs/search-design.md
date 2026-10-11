# Search and filter design

One API for web and Android, so both behave identically.

## Endpoint
`GET /api/v1/catalog/search`

| Param | Meaning |
|-------|---------|
| `q` | text query (name, brand, SKU, category, description, attributes) |
| `category` | category slug; includes its subcategories |
| `brand`, `condition`, `in_stock` | universal filters |
| `price_min`, `price_max` | in major units, converted on the server |
| `attr[key]=value` | category attribute filters, e.g. `attr[storage]=128GB&attr[colour]=Black`; repeat for multiple values |
| `sort` | `relevance`, `price_asc`, `price_desc`, `newest` |
| `page`, `page_size` | page_size capped at 48 |

Response: `items[]`, `total`, `page`, and `facets[]` (only filterable attributes of the current category, each with its option values and counts). Unpublished products are never returned.

## How it works in PostgreSQL
- A generated `tsvector` column built from name, brand, SKU, category name and searchable attributes, with a GIN index.
- `pg_trgm` index on name and brand for spelling tolerance ("samsng" still finds Samsung).
- GIN index on `attributes` for filter matching; indexes on `category_id`, price, `published`.
- Relevance = full-text rank, then trigram similarity, then newest as tiebreaker.
- Attribute keys are checked against `attribute_definitions` before they reach SQL; values are bound parameters, never concatenated.

## Rules
- Facets are computed per category; a fridge never shows "shoe size".
- Filters combine with AND across attributes and OR within one attribute's values.
- Empty results return suggestions: relax the last filter, or similar categories.
- No ratings, popularity or discount filters until real data exists.
- A dedicated search engine is considered only if measured query time or relevance is not good enough.

## Tests (Stage 8)
Single filter; multiple filters; price range edges; unknown attribute key rejected; unpublished hidden; pagination boundaries; typo query; category with and without children; facet counts match results.
