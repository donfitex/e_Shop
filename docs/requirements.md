# Requirements and acceptance criteria (launch scope)

## Scope
One store operator (single retailer), with a database shaped so vendors can be added later.
Launch categories: **Mobile phones, Electronics accessories, Fashion, Home & Kitchen**.
Out of scope for now: groceries and perishables, medical or age-restricted products, digital products and gift cards, vendor payouts and commissions, live courier tracking, reviews and ratings.

## Functional requirements
| ID | Requirement | Priority |
|----|-------------|----------|
| F1 | Admin creates, renames, reorders, hides categories and subcategories without code changes | Must |
| F2 | Admin defines per-category attributes (type, label, unit, options, filterable, required) | Must |
| F3 | Products belong to one category and hold validated attribute values | Must |
| F4 | Variants (size, colour, storage...) each with own SKU, price and stock | Must |
| F5 | Search across all categories; filters shown only if relevant to the results | Must |
| F6 | Sort by relevance, price, newest; pagination | Must |
| F7 | Stock cannot go negative; concurrent orders cannot oversell | Must |
| F8 | Cart and checkout recalculate everything on the server; duplicate submits are safe | Must |
| F9 | Paystack payments confirmed by verified webhook; pay on delivery kept | Must |
| F10 | Admin sees orders, payment and fulfilment status, inventory history, low stock | Must |
| F11 | Saved products and recently viewed | Should |
| F12 | Coupons (percent or fixed, expiry, usage limits) | Should |
| F13 | Native Android app using the same API | Must (later stages) |

## Rules
- **Order status:** `pending` (pay on delivery) or `awaiting_payment` -> `paid` -> `processing` -> `dispatched` -> `delivered`; `cancelled` and `refunded` are terminal. Status moves only through server code.
- **Stock:** pay on delivery reduces stock when the order is created. Online payment reserves stock for 30 minutes; an unpaid reservation is released automatically. Cancelling returns stock. Every change writes an inventory movement row.
- **Cart:** if a price or stock changes before checkout, the customer sees the change and must confirm; the server never trusts client totals.
- **Money:** whole minor units (kobo) with an explicit currency column. Launch currency: NGN.

## Acceptance criteria (each must be demonstrated by a test or a recorded manual check)
1. Existing phones and orders are intact after migration.
2. An admin adds "School Supplies" with filters brand, colour, material and lists a product; it appears in search and filters with no code change.
3. A shirt with 3 sizes x 2 colours keeps separate stock per variant.
4. Searching "samsung phone" and "men black sneakers" returns relevant products from the right categories.
5. Brand + price range + one category attribute together return exactly the matching products; clear-all resets.
6. Two simultaneous orders for the last unit: one succeeds, one is refused.
7. Submitting checkout twice creates one order.
8. A test payment is marked paid only after a signature-verified webhook or server-side verification.
9. The same webhook delivered twice changes nothing the second time.
10. A customer cannot read another customer's order or call admin endpoints.
