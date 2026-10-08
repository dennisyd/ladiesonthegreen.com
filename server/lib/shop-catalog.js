import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import multer from "multer";
import { products, SHIPPING_CENTS } from "../../shared/shop.js";

export const settingsOf = (data) => ({ shippingCents: SHIPPING_CENTS, ...data.settings });
export const productsOf = (data) => (data.products ?? products).map((p) => ({ ...p, images: p.images ?? [p.image], active: p.active !== false, stock: Object.hasOwn(data.stock, p.id) ? data.stock[p.id] : p.stock }));
const text = (v, max) => String(v ?? "").trim().slice(0, max);
function safeUrl(value, image = false) {
  if (image && /^\/(merch|uploads\/shop)\/[a-zA-Z0-9_.-]+$/.test(value)) return true;
  try { const u = new URL(value); return u.protocol === "https:" && !u.username && !u.password; } catch { return false; }
}
function validate(raw) {
  const name = text(raw.name, 120), price = Number(raw.price);
  const stock = raw.stock === null || raw.stock === "" ? null : Number(raw.stock);
  const images = Array.isArray(raw.images) ? raw.images : [];
  const stripeLink = text(raw.stripeLink, 1000), link = text(raw.link, 1000);
  if (!name || !Number.isSafeInteger(price) || price < 50 || price > 99999999) throw new Error("Enter a product name and a price between $0.50 and $999,999.99.");
  if (stock !== null && (!Number.isSafeInteger(stock) || stock < 0)) throw new Error("Stock must be a whole number of 0 or more, or blank for unlimited.");
  if (!images.length || images.length > 12 || images.some((u) => typeof u !== "string" || u.length > 1000 || !safeUrl(u, true))) throw new Error("Add 1–12 photos using uploads or HTTPS image addresses.");
  if (stripeLink && (!safeUrl(stripeLink) || new URL(stripeLink).hostname !== "buy.stripe.com")) throw new Error("Enter a Stripe payment link starting with https://buy.stripe.com/.");
  if (link && !safeUrl(link)) throw new Error("The product website address must start with https://.");
  return { name, price, stock, images, image: images[0], stripeLink, link, tagline: text(raw.tagline, 80), description: text(raw.description, 3000), details: (Array.isArray(raw.details) ? raw.details : []).slice(0, 20).map((v) => text(v, 300)).filter(Boolean), active: raw.active !== false };
}

export function mountCatalog(app, store, dataDir, requireAdmin) {
  const uploadDir = path.join(dataDir, "..", "uploads", "shop");
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 12 } });
  app.post("/api/admin/shop/images", requireAdmin, (req, res) => {
    upload.array("images", 12)(req, res, async (err) => {
      if (err) return res.status(400).json({ error: "Upload up to 12 photos, each under 5 MB." });
      const files = req.files ?? [];
      const extension = (b) => b.subarray(0, 3).equals(Buffer.from([255,216,255])) ? "jpg" : b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? "png" : b.toString("ascii",0,4) === "RIFF" && b.toString("ascii",8,12) === "WEBP" ? "webp" : null;
      if (!files.length || files.some((f) => !extension(f.buffer))) return res.status(400).json({ error: "Choose JPG, PNG, or WebP photos." });
      try {
        await fs.mkdir(uploadDir, { recursive: true });
        const images = [];
        for (const f of files) { const name = `${crypto.randomUUID()}.${extension(f.buffer)}`; await fs.writeFile(path.join(uploadDir, name), f.buffer); images.push(`/uploads/shop/${name}`); }
        res.json({ ok: true, images });
      } catch { res.status(500).json({ error: "Photos could not be saved. Please try again." }); }
    });
  });
  const save = async (req, res) => {
    let product;
    try { product = validate(req.body ?? {}); } catch (err) { return res.status(400).json({ error: err.message }); }
    const id = req.params.id || crypto.randomUUID();
    const saved = await store.update((data) => {
      data.products ??= structuredClone(products);
      const index = data.products.findIndex((p) => p.id === id);
      if (req.params.id && index < 0) return false;
      product.id = id;
      if (index < 0) data.products.push(product); else data.products[index] = product;
      data.stock[id] = product.stock;
      return true;
    });
    res.status(saved ? 200 : 404).json(saved ? { ok: true, product } : { error: "Product not found." });
  };
  app.post("/api/admin/shop/products", requireAdmin, save);
  app.put("/api/admin/shop/products/:id", requireAdmin, save);
  app.patch("/api/admin/shop/products/:id/move", requireAdmin, async (req, res) => {
    const direction = req.body?.direction;
    if (direction !== "up" && direction !== "down") return res.status(400).json({ error: "Choose up or down." });
    const result = await store.update((data) => {
      data.products ??= structuredClone(products);
      const index = data.products.findIndex((p) => p.id === req.params.id);
      if (index < 0) return null;
      const destination = index + (direction === "up" ? -1 : 1);
      if (destination >= 0 && destination < data.products.length) {
        [data.products[index], data.products[destination]] = [data.products[destination], data.products[index]];
      }
      return productsOf(data);
    });
    if (!result) return res.status(404).json({ error: "Product not found." });
    res.json({ ok: true, products: result });
  });
  app.delete("/api/admin/shop/products/:id", requireAdmin, async (req, res) => {
    await store.update((data) => { data.products ??= structuredClone(products); data.products = data.products.filter((p) => p.id !== req.params.id); delete data.stock[req.params.id]; });
    res.json({ ok: true });
  });
  app.put("/api/admin/shop/settings", requireAdmin, async (req, res) => {
    const shippingCents = Number(req.body?.shippingCents);
    if (!Number.isSafeInteger(shippingCents) || shippingCents < 0 || shippingCents > 999999) return res.status(400).json({ error: "Enter a valid shipping fee." });
    await store.update((data) => { data.settings = { shippingCents }; });
    res.json({ ok: true });
  });
}
