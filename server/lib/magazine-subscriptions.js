import path from "node:path";
import crypto from "node:crypto";
import { jsonStore } from "./store.js";
import { createAuth, createRateLimiter, readCookie, setCookie } from "./auth.js";
import { createMemberCodes } from "./member-codes.js";
import { sendEmail } from "./mailer.js";

const DAY = 24 * 60 * 60 * 1000;
const COOKIE = "lotg_magazine";
const TTL = 30 * 24 * 60 * 60;
const id = (value) => typeof value === "string" ? value : value?.id;
export function subscriptionAccess(record, now = Date.now()) {
  if (!record || !["active", "trialing"].includes(record.status) || Date.parse(record.expiresAt) <= now || !Number.isFinite(Date.parse(record.expiresAt))) return "expired";
  return Date.parse(record.availableAt) <= now ? "ready" : "waiting";
}

export function createMagazineSubscriptions(dataDir, { stripe, requireMember, send = sendEmail, now = Date.now }) {
  const store = jsonStore(path.join(dataDir, "magazine-subscriptions.json"), { subscribers: [] });
  const auth = createAuth(dataDir);
  const codes = createMemberCodes(path.join(dataDir, "magazine-auth"), auth.digest, now);
  const allow = createRateLimiter(20, 15 * 60 * 1000);
  const base = () => (process.env.SITE_URL || "https://ladiesonthegreen.com").replace(/\/$/, "");
  const view = (record) => ({ ok: true, access: subscriptionAccess(record, now()), availableAt: record.availableAt, expiresAt: record.expiresAt });
  async function current(req) {
    const token = auth.verify(readCookie(req, COOKIE), "magazine");
    return token && (await store.read()).subscribers.find((item) => item.id === token.sid);
  }
  function signIn(req, res, record) {
    setCookie(req, res, COOKIE, auth.sign({ t: "magazine", sid: record.id }, TTL), TTL);
  }
  async function recordPayment(session, paidAt) {
    if (session.metadata?.product !== "collective-magazine" || session.payment_status !== "paid") return null;
    if (session.currency !== "usd" || session.amount_total !== 1999 || !id(session.subscription)) throw new Error("Unexpected magazine payment.");
    const sub = await stripe.subscriptions.retrieve(id(session.subscription));
    const end = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;
    if (!end) throw new Error("Missing subscription period.");
    const email = String(session.customer_details?.email || session.customer_email || "").trim().toLowerCase();
    if (!email) throw new Error("Missing subscriber email.");
    return store.update((data) => {
      const existing = data.subscribers.find((item) => item.checkoutId === session.id);
      if (existing) return existing; // Retries never restart the waiting period.
      const record = { id: crypto.randomUUID(), email, checkoutId: session.id, subscriptionId: sub.id,
        paidAt: new Date(paidAt).toISOString(), availableAt: new Date(paidAt + DAY).toISOString(),
        expiresAt: new Date(end * 1000).toISOString(), status: sub.status };
      data.subscribers.push(record);
      return record;
    });
  }
  async function handleEvent(event) {
    const object = event.data.object;
    if (["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type) && object.metadata?.product === "collective-magazine") {
      await recordPayment(object, event.created * 1000);
      return "magazine";
    }
    if (["customer.subscription.updated", "customer.subscription.deleted", "invoice.paid", "invoice.payment_failed"].includes(event.type)) {
      const subscriptionId = event.type.startsWith("invoice.") ? id(object.subscription) || id(object.parent?.subscription_details?.subscription) : object.id;
      const known = (await store.read()).subscribers.some((item) => item.subscriptionId === subscriptionId);
      if (!known) return null;
      const latest = await stripe.subscriptions.retrieve(subscriptionId);
      await store.update((data) => {
        for (const record of data.subscribers.filter((item) => item.subscriptionId === subscriptionId)) {
          record.status = latest.status;
          const end = latest.current_period_end ?? latest.items?.data?.[0]?.current_period_end;
          if (end) record.expiresAt = new Date(end * 1000).toISOString();
        }
      });
      return "magazine";
    }
    return null;
  }
  async function requireAccess(req, res, next) {
    // Club members retain their included access, even on a shared browser.
    if (readCookie(req, "lotg_member")) {
      const token = auth.verify(readCookie(req, "lotg_member"), "member");
      if (token) return requireMember(req, res, next);
    }
    const record = await current(req);
    if (!record) return requireMember(req, res, next);
    res.set("Cache-Control", "private, no-store");
    const access = subscriptionAccess(record, now());
    if (access !== "ready") return res.status(access === "waiting" ? 425 : 403).json({ ...view(record), ok: false,
      error: access === "waiting" ? `Your magazine access begins 24 hours after payment, on ${record.availableAt}.` : "Your magazine subscription is not active." });
    next();
  }
  function mountRoutes(app) {
    app.use("/api/magazine-subscription", (_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
    app.post("/api/magazine-subscription/checkout", async (req, res) => {
      if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(503).json({ ok: false, error: "Magazine checkout is temporarily unavailable. Please try again later." });
      if (!allow(req.ip)) return res.status(429).json({ ok: false, error: "Please try again later." });
      const email = String(req.body?.email || "").trim().toLowerCase();
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ ok: false, error: "Enter a valid email address." });
      const session = await stripe.checkout.sessions.create({ mode: "subscription", customer_email: email,
        metadata: { product: "collective-magazine" }, subscription_data: { metadata: { product: "collective-magazine" } },
        line_items: [{ price_data: { currency: "usd", unit_amount: 1999, recurring: { interval: "year" }, product_data: { name: "The Collective Magazine — Annual Digital Subscription" } }, quantity: 1 }],
        success_url: `${base()}/subscribe?checkout={CHECKOUT_SESSION_ID}`, cancel_url: `${base()}/subscribe?canceled=1` });
      res.json({ ok: true, url: session.url });
    });
    app.post("/api/magazine-subscription/confirm", async (req, res) => {
      if (!stripe || !allow(req.ip)) return res.status(503).json({ ok: false, error: "Please try again later." });
      const checkoutId = String(req.body?.checkoutId || "");
      if (!/^cs_[A-Za-z0-9_]+$/.test(checkoutId)) return res.status(400).json({ ok: false, error: "Invalid checkout." });
      const session = await stripe.checkout.sessions.retrieve(checkoutId);
      if (session.metadata?.product !== "collective-magazine" || session.payment_status !== "paid") return res.status(409).json({ ok: false, error: "Payment is still being confirmed. Please sign in again shortly." });
      // Only the verified webhook establishes the payment time and entitlement.
      const record = (await store.read()).subscribers.find((item) => item.checkoutId === checkoutId);
      if (!record) return res.status(409).json({ ok: false, error: "Payment received. Your order is being confirmed; please sign in shortly using your checkout email." });
      signIn(req, res, record);
      res.json(view(record));
    });
    app.get("/api/magazine-subscription/me", async (req, res) => {
      const record = await current(req);
      if (!record) return res.status(401).json({ ok: false, error: "Sign in with your checkout email." });
      res.json(view(record));
    });
    app.post("/api/magazine-subscription/login", async (req, res) => {
      if (!allow(req.ip)) return res.status(429).json({ ok: false, error: "Please try again later." });
      const email = String(req.body?.email || "").trim().toLowerCase();
      const record = (await store.read()).subscribers.filter((item) => item.email === email).sort((a,b) => b.paidAt.localeCompare(a.paidAt))[0];
      const challengeId = crypto.randomUUID();
      if (!record) return res.json({ ok: true, challengeId, message: "If you have a subscription, a sign-in code will arrive by email." });
      const challenge = await codes.issue(record.id);
      try { await send({ to: email, subject: "Your Collective Magazine sign-in code", text: `Your sign-in code is ${challenge.code}. It expires in 10 minutes. Enter it at ${base()}/subscribe. Do not share this code.` }); }
      catch { await codes.revoke(challenge.id); return res.status(503).json({ ok: false, error: "We couldn't send your code. Please try again." }); }
      res.json({ ok: true, challengeId: challenge.id, message: "If you have a subscription, a sign-in code will arrive by email." });
    });
    app.post("/api/magazine-subscription/verify", async (req, res) => {
      if (!allow(req.ip)) return res.status(429).json({ ok: false, error: "Please try again later." });
      const sid = await codes.consume(String(req.body?.challengeId || ""), String(req.body?.code || "").trim());
      const record = sid && (await store.read()).subscribers.find((item) => item.id === sid);
      if (!record) return res.status(400).json({ ok: false, error: "Incorrect or expired code." });
      signIn(req, res, record);
      res.json(view(record));
    });
    app.post("/api/magazine-subscription/billing", async (req, res) => {
      const record = await current(req);
      if (!record || !stripe) return res.status(401).json({ ok: false, error: "Please sign in." });
      const sub = await stripe.subscriptions.retrieve(record.subscriptionId);
      const session = await stripe.billingPortal.sessions.create({ customer: id(sub.customer), return_url: `${base()}/subscribe` });
      res.json({ ok: true, url: session.url });
    });
  }
  return { mountRoutes, handleEvent, requireAccess };
}
