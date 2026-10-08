import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import express from "express";
import { createShop } from "./shop.js";

test("editable catalog, protected writes, uploads, persistence, checkout and historical orders", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lotg-shop-test-"));
  const dataDir = path.join(root, "data");
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  let checkout;
  const stripe = { checkout: { sessions: { create: async (options) => { checkout = options; return { id: "cs_test", url: "https://checkout.stripe.com/test" }; } } } };
  const requireAdmin = (req, res, next) => req.headers.authorization === "test-admin" ? next() : res.status(401).json({ error: "Sign in" });
  const start = async () => {
    const app = express(); app.use(express.json());
    const shop = createShop(dataDir, { stripe, requireAdmin }); shop.mountRoutes(app);
    const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
    const request = async (url, { method = "GET", body, auth = true } = {}) => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}${url}`, { method, headers: { ...(auth ? { authorization: "test-admin" } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
      return { status: response.status, ...(await response.json()) };
    };
    return { shop, server, request };
  };
  let running = await start();
  t.after(() => new Promise((resolve) => running.server.close(resolve)));
  let { request } = running;
  assert.equal((await request("/api/shop")).products.length, 4);
  const product = { name: "New cap", price: 2300, stock: 5, images: ["/merch/hat-pink.jpg", "/merch/hat-white.jpg"], description: "Two photos", details: ["One size"], active: true };
  assert.equal((await request("/api/admin/shop/products", { method: "POST", body: product, auth: false })).status, 401);
  for (const change of [{ price: -1 }, { stock: 1.5 }, { stripeLink: "https://evil.example/buy" }, { images: ["javascript:alert(1)"] }]) {
    assert.equal((await request("/api/admin/shop/products", { method: "POST", body: { ...product, ...change } })).status, 400);
  }
  const created = await request("/api/admin/shop/products", { method: "POST", body: product });
  assert.equal(created.status, 200); const id = created.product.id;
  await request("/api/admin/shop/settings", { method: "PUT", body: { shippingCents: 750 } });
  assert.equal((await request("/api/shop")).shippingCents, 750);
  assert.equal((await request("/api/shop/checkout", { method: "POST", body: { items: [{ id, qty: 6 }] } })).status, 400);
  assert.equal((await request("/api/shop/checkout", { method: "POST", body: { items: [{ id, qty: 2 }], price: 1 } })).status, 200);
  assert.equal(checkout.line_items[0].price_data.unit_amount, 2300);
  assert.equal(checkout.shipping_options[0].shipping_rate_data.fixed_amount.amount, 750);
  await request(`/api/admin/shop/products/${id}`, { method: "PUT", body: { ...product, name: "Renamed cap", price: 9900 } });
  const event = { type: "checkout.session.completed", data: { object: { id: "cs_test", metadata: checkout.metadata, payment_status: "paid", amount_total: 5350 } } };
  await running.shop.handleEvent(event); await running.shop.handleEvent(event);
  let admin = await request("/api/admin/shop");
  assert.equal(admin.orders.length, 1); assert.equal(admin.orders[0].items[0].name, "New cap"); assert.equal(admin.orders[0].items[0].price, 2300);
  assert.equal(admin.products.find((p) => p.id === id).stock, 3);
  await request(`/api/admin/shop/products/${id}`, { method: "PUT", body: { ...product, active: false } });
  assert.ok(!(await request("/api/shop")).products.some((p) => p.id === id));
  assert.equal((await request("/api/shop/checkout", { method: "POST", body: { items: [{ id, qty: 1 }] } })).status, 400);
  await request(`/api/admin/shop/products/${id}`, { method: "PUT", body: { ...product, stripeLink: "https://buy.stripe.com/test" } });
  assert.equal((await request("/api/shop")).products.find((p) => p.id === id).stripeLink, "https://buy.stripe.com/test");
  assert.equal((await request("/api/shop/checkout", { method: "POST", body: { items: [{ id, qty: 1 }] } })).status, 400);
  const upload = async (bytes, auth = true) => {
    const form = new FormData(); form.append("images", new Blob([bytes]), "photo.png");
    const res = await fetch(`http://127.0.0.1:${running.server.address().port}/api/admin/shop/images`, { method: "POST", headers: auth ? { authorization: "test-admin" } : {}, body: form });
    return { status: res.status, ...await res.json() };
  };
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=", "base64");
  assert.equal((await upload(png, false)).status, 401);
  assert.equal((await upload(Buffer.from("<svg>bad</svg>"))).status, 400);
  const uploaded = await upload(png); assert.equal(uploaded.status, 200);
  assert.deepEqual(await fs.readFile(path.join(root, uploaded.images[0])), png);
  await new Promise((resolve) => running.server.close(resolve)); running = await start(); request = running.request;
  admin = await request("/api/admin/shop"); assert.equal(admin.orders.length, 1); assert.equal(admin.products.find((p) => p.id === id).images.length, 2); assert.equal(admin.settings.shippingCents, 750);
  await request(`/api/admin/shop/products/${id}`, { method: "DELETE" });
  assert.ok(!(await request("/api/shop")).products.some((p) => p.id === id));
  assert.equal((await request("/api/admin/shop")).orders[0].items[0].name, "New cap");
  // Empty catalogs remain empty across restarts; seed products must not reappear.
  for (const p of (await request("/api/shop")).products) await request(`/api/admin/shop/products/${p.id}`, { method: "DELETE" });
  await new Promise((resolve) => running.server.close(resolve)); running = await start();
  assert.equal((await running.request("/api/shop")).products.length, 0);
});
