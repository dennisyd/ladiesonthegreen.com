import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import express from "express";
import { createMagazineSubscriptions, subscriptionAccess } from "./lib/magazine-subscriptions.js";

test("existing purchases use their original payment time instead of their stored 24-hour unlock time", () => {
  const paid = Date.parse("2026-11-23T12:00:00Z");
  const record = { status: "active", paidAt: new Date(paid).toISOString(), availableAt: new Date(paid + 86400000).toISOString(), expiresAt: new Date(paid + 365*86400000).toISOString() };
  assert.equal(subscriptionAccess(record, paid + 30*60000), "waiting");
  assert.equal(subscriptionAccess(record, paid + 3600000 - 1), "waiting");
  assert.equal(subscriptionAccess(record, paid + 3600000), "ready");
  assert.equal(subscriptionAccess(record, paid + 2*3600000), "ready");
});

test("paid magazine access waits exactly one hour, persists on retry, and requires subscriber authentication", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lotg-magazine-paid-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  let now = Date.parse("2026-11-23T12:00:00Z");
  const paid = now;
  const sub = { id: "sub_magazine", status: "active", customer: "cus_magazine", current_period_end: Math.floor(now/1000) + 365*86400 };
  const session = { id: "cs_test_magazine", metadata: { product: "collective-magazine" }, payment_status: "paid", currency: "usd", amount_total: 1999, subscription: sub.id, customer_details: { email: "reader@example.com" } };
  let email;
  let checkout;
  const oldWebhook = process.env.STRIPE_WEBHOOK_SECRET;
  process.env.STRIPE_WEBHOOK_SECRET = "test-webhook-configured";
  t.after(() => { if (oldWebhook === undefined) delete process.env.STRIPE_WEBHOOK_SECRET; else process.env.STRIPE_WEBHOOK_SECRET = oldWebhook; });
  const feature = createMagazineSubscriptions(dir, { now: () => now,
    stripe: { subscriptions: { retrieve: async () => sub }, checkout: { sessions: { retrieve: async () => session,
      create: async (params) => { checkout = params; return { url: "https://checkout.stripe.com/test" }; } } } },
    requireMember: (req, res, next) => req.get("x-member") === "yes" ? next() : res.sendStatus(401),
    send: async (message) => { email = message; }
  });
  const app = express(); app.use(express.json()); feature.mountRoutes(app);
  app.get(["/api/magazine", "/uploads/magazine/issue.pdf"], feature.requireAccess, (_req, res) => res.json({ readable: true }));
  const server = await new Promise((resolve) => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (action, body) => fetch(`${base}/api/magazine-subscription/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  assert.equal((await post("checkout", { email: "invalid" })).status, 400);
  assert.equal((await post("checkout", { email: "reader@example.com", price: 1 })).status, 200);
  assert.equal(checkout.mode, "subscription");
  assert.equal(checkout.line_items[0].price_data.unit_amount, 1999);
  assert.equal(checkout.line_items[0].price_data.recurring.interval, "year");
  assert.match(checkout.success_url, /checkout=\{CHECKOUT_SESSION_ID\}/);
  assert.equal(await feature.handleEvent({ type: "checkout.session.completed", data: { object: { metadata: {} } } }), null);
  await assert.rejects(feature.handleEvent({ type: "checkout.session.completed", created: paid/1000, data: { object: { ...session, amount_total: 1 } } }), /Unexpected magazine payment/);
  assert.equal((await fetch(base + "/api/magazine")).status, 401);
  assert.equal((await post("confirm", { checkoutId: session.id })).status, 409);
  await feature.handleEvent({ type: "checkout.session.completed", created: paid/1000, data: { object: { ...session, payment_status: "unpaid" } } });
  assert.equal((await post("confirm", { checkoutId: session.id })).status, 409);
  await feature.handleEvent({ type: "checkout.session.completed", created: paid/1000, data: { object: session } });
  const confirmed = await post("confirm", { checkoutId: session.id });
  const cookie = confirmed.headers.get("set-cookie").split(";")[0];
  assert.equal((await confirmed.json()).access, "waiting");
  now += 3600000 - 1;
  await feature.handleEvent({ type: "checkout.session.completed", created: now/1000, data: { object: session } });
  for (const url of ["/api/magazine", "/uploads/magazine/issue.pdf"]) assert.equal((await fetch(base + url, { headers: { cookie } })).status, 425);
  assert.equal((await fetch(base + "/api/magazine", { headers: { "x-member": "yes" } })).status, 200);
  now += 1;
  for (const url of ["/api/magazine", "/uploads/magazine/issue.pdf"]) assert.equal((await fetch(base + url, { headers: { cookie } })).status, 200);
  const saved = JSON.parse(await fs.readFile(path.join(dir, "magazine-subscriptions.json"), "utf8"));
  assert.equal(saved.subscribers.length, 1);
  assert.equal(saved.subscribers[0].availableAt, new Date(paid + 3600000).toISOString());
  const challenge = await (await post("login", { email: "reader@example.com" })).json();
  assert.equal((await post("verify", { challengeId: challenge.challengeId, code: "bad" })).status, 400);
  const code = email.text.match(/\b\d{6}\b/)[0];
  assert.equal((await post("verify", { challengeId: challenge.challengeId, code })).status, 200);
  assert.equal((await post("verify", { challengeId: challenge.challengeId, code })).status, 400);
  sub.status = "past_due";
  await feature.handleEvent({ type: "invoice.payment_failed", data: { object: { subscription: sub.id } } });
  assert.equal((await fetch(base + "/api/magazine", { headers: { cookie } })).status, 403);
  sub.status = "active"; sub.current_period_end += 365*86400;
  await feature.handleEvent({ type: "invoice.paid", data: { object: { parent: { subscription_details: { subscription: sub.id } } } } });
  assert.equal((await fetch(base + "/api/magazine", { headers: { cookie } })).status, 200);
  sub.status = "canceled";
  await feature.handleEvent({ type: "customer.subscription.deleted", data: { object: sub } });
  assert.equal((await fetch(base + "/uploads/magazine/issue.pdf", { headers: { cookie } })).status, 403);
});
