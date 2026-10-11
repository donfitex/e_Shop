import { HttpError } from "./errors.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v) => typeof v === "string" && UUID.test(v);
const bad = (message) => { throw new HttpError(400, message, "validation_error"); };

// Trim, strip control characters, enforce length. Single-line by default.
export function text(v, { field, min = 0, max, multiline = false }) {
  if (v != null && typeof v !== "string") bad(`${field} must be text.`);
  let s = (v ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();
  if (!multiline) s = s.replace(/\s+/g, " ");
  if (min > 0 && s.length === 0) bad(`${field} is required.`);
  if (s.length < min) bad(`${field} is too short.`);
  if (s.length > max) bad(`${field} must be at most ${max} characters.`);
  return s;
}

export function parseCheckout(b) {
  b = b && typeof b === "object" ? b : {};
  if (!Array.isArray(b.items) || b.items.length === 0) bad("Your cart is empty.");
  if (b.items.length > 50) bad("Too many items in one order.");
  const qtys = new Map();
  for (const i of b.items) {
    if (!isUuid(i?.id)) bad("A phone in your cart is invalid.");
    const q = Number(i.qty);
    if (!Number.isInteger(q) || q < 1) bad("Quantity must be a whole number of at least 1.");
    const total = (qtys.get(i.id) || 0) + q;
    if (total > 20) bad("You can order at most 20 of one phone at a time.");
    qtys.set(i.id, total);
  }
  const s = b.shipping && typeof b.shipping === "object" ? b.shipping : {};
  const shipping = {
    name: text(s.name, { field: "Name", min: 2, max: 100 }),
    address: text(s.address, { field: "Address", min: 5, max: 300 }),
    city: text(s.city, { field: "City", min: 2, max: 100 }),
  };
  const method = b.method ?? "cod";
  if (!["cod", "paystack"].includes(method)) bad("Choose a payment method.");
  return { items: [...qtys].map(([id, qty]) => ({ id, qty })), shipping, method };
}

// Admin product input. Photos must come from our own storage bucket (imagePrefix).
export function parseProduct(b, imagePrefix) {
  b = b && typeof b === "object" ? b : {};
  const name = text(b.name, { field: "Name", min: 1, max: 120 });
  const price = Number(b.price);
  if (b.price === "" || b.price == null || !Number.isFinite(price) || price < 0 || price > 100_000_000) bad("Enter a valid price.");
  const stock = Number(b.stock);
  if (!Number.isInteger(stock) || stock < 0 || stock > 100_000) bad("Stock must be a whole number from 0 to 100000.");
  const raw = b.images == null ? [] : b.images;
  if (!Array.isArray(raw)) bad("Photos must be a list.");
  const images = [...new Set(raw)];
  if (images.length > 8) bad("Up to 8 photos per phone.");
  for (const u of images) {
    if (typeof u !== "string" || u.length > 500 || (imagePrefix && !u.startsWith(imagePrefix))) bad("Photos must be uploaded through the admin page.");
  }
  return {
    name,
    brand: text(b.brand, { field: "Brand", max: 60 }),
    specs: text(b.specs, { field: "Specs", max: 200 }),
    description: text(b.description, { field: "Description", max: 2000, multiline: true }),
    color: /^#[0-9a-f]{6}$/i.test(b.color) ? b.color : "#2F3B4C",
    images,
    stock,
    active: b.active !== false,
    price_cents: Math.round(price * 100),
  };
}
