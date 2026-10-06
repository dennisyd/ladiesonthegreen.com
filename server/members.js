import express from "express";
import crypto from "node:crypto";
import path from "node:path";
import Stripe from "stripe";
import { FOUNDING_DEADLINE_LABEL, currentRate, regularRate } from "../shared/membership.js";
import { clearCookie, createAuth, createRateLimiter, readCookie, safeEqual, setCookie } from "./lib/auth.js";
import { mailConfigured, sendEmail } from "./lib/mailer.js";
import { canUsePortal, directoryView, newMember, normalizeEmail, portalView } from "./lib/member-model.js";
import { jsonStore } from "./lib/store.js";
import { createStripeSync } from "./lib/stripe-sync.js";

const ADMIN_COOKIE = "lotg_admin";
const MEMBER_COOKIE = "lotg_member";
const ADMIN_SESSION_SECONDS = 12 * 60 * 60;
const MEMBER_SESSION_SECONDS = 30 * 24 * 60 * 60;
const SIGN_IN_LINK_SECONDS = 30 * 60;
const MEMBER_STATUSES = ["registered", "active", "past_due", "canceled"];
const OFFER_CATEGORIES = ["Offer", "Discount code", "Event"];

const firstName = (name) => String(name || "").trim().split(/\s+/)[0] || "there";
const clean = (value, max = 500) => String(value ?? "").trim().slice(0, max);
const isHttpUrl = (value) => /^https?:\/\/\S+$/i.test(value);

function csv(rows, columns) {
  const escape = (value) => {
    const text = value == null ? "" : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [columns.map((c) => c.label), ...rows.map((row) => columns.map((c) => c.value(row)))]
    .map((line) => line.map(escape).join(","))
    .join("\r\n");
}

export function createMembership(dataDir) {
  const members = jsonStore(path.join(dataDir, "members.json"), { members: [] });
  const offers = jsonStore(path.join(dataDir, "offers.json"), { offers: [] });
  const registrations = jsonStore(path.join(dataDir, "registrations.json"), { registrations: [] });
  const announcements = jsonStore(path.join(dataDir, "announcements.json"), { announcements: [] });
  const stripeStatus = jsonStore(path.join(dataDir, "stripe-status.json"), {});

  const auth = createAuth(dataDir);
  const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const sync = stripe ? createStripeSync({ stripe, members, registrations }) : null;
  // Falls back to the magazine password so the dashboard works before a separate one is set.
  const adminPassword = process.env.ADMIN_PASSWORD || process.env.MAGAZINE_ADMIN_PASSWORD;

  // Other features (the shop) can claim Stripe events before membership tracking sees them.
  const webhookHandlers = [];

  const allowAdminLogin = createRateLimiter(8, 15 * 60 * 1000);
  const allowMemberLogin = createRateLimiter(5, 15 * 60 * 1000);

  const origin = (req) => process.env.SITE_URL || `${req.protocol}://${req.get("host")}`;

  // --- Join form ----------------------------------------------------------

  // Save (or refresh) an application. Never downgrades a member who has paid.
  async function recordApplication(fields) {
    const email = normalizeEmail(fields.email);
    return members.update((data) => {
      const existing = data.members.find((m) => m.email === email);
      if (existing) {
        for (const key of ["name", "phone", "address", "address2", "city", "state", "zip", "country"]) {
          if (fields[key]) existing[key] = clean(fields[key]);
        }
        existing.updatedAt = new Date().toISOString();
        return existing.id;
      }
      const member = newMember({
        ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, clean(v)])),
        rateAtSignup: currentRate().amount
      });
      data.members.push(member);
      return member.id;
    });
  }

  // --- Emails -------------------------------------------------------------

  function reminderEmail(member, req) {
    const rate = currentRate();
    return {
      to: member.email,
      subject: rate.isFounding
        ? `Your $${rate.amount} founding membership is waiting`
        : "Finish joining Ladies On The Green",
      text: [
        `Hi ${firstName(member.name)},`,
        "",
        "Thank you for starting your Ladies On The Green membership. Your spot is confirmed once payment is complete.",
        "",
        ...(rate.isFounding
          ? [`The $${rate.amount} annual founding rate expires ${FOUNDING_DEADLINE_LABEL}. After that, membership is $${regularRate.amount}/year.`, ""]
          : []),
        `Complete your membership here: ${origin(req)}/join`,
        "",
        "Questions? Just reply to this email.",
        "",
        "Ladies On The Green"
      ].join("\n")
    };
  }

  async function sendReminder(member, req) {
    await sendEmail(reminderEmail(member, req));
    await members.update((data) => {
      const m = data.members.find((x) => x.id === member.id);
      if (m) m.reminders = { count: (m.reminders?.count || 0) + 1, lastAt: new Date().toISOString() };
    });
  }

  // --- Middleware ---------------------------------------------------------

  function requireAdmin(req, res, next) {
    if (!auth.verify(readCookie(req, ADMIN_COOKIE), "admin")) {
      return res.status(401).json({ ok: false, error: "Please sign in." });
    }
    next();
  }

  async function requireMember(req, res, next) {
    const session = auth.verify(readCookie(req, MEMBER_COOKIE), "member");
    if (!session) return res.status(401).json({ ok: false, error: "Please sign in." });
    const { members: list } = await members.read();
    const member = list.find((m) => m.id === session.mid);
    if (!canUsePortal(member)) {
      clearCookie(req, res, MEMBER_COOKIE);
      return res.status(403).json({ ok: false, error: "Your membership is not active." });
    }
    req.member = member;
    next();
  }

  // --- Stripe webhook (needs the raw body, so mount before express.json) ---

  function mountWebhook(app) {
    app.post("/api/stripe/webhook", express.raw({ type: "application/json", limit: "1mb" }), async (req, res) => {
      if (!stripe || !webhookSecret) {
        return res.status(503).send("Stripe is not configured on this server.");
      }
      let event;
      try {
        event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], webhookSecret);
      } catch (error) {
        return res.status(400).send(`Webhook signature check failed: ${error.message}`);
      }
      try {
        let result = null;
        for (const handler of webhookHandlers) {
          result = await handler(event);
          if (result) break;
        }
        result ||= await sync.handleEvent(event);
        await stripeStatus.update((s) => {
          s.lastWebhookAt = new Date().toISOString();
          s.lastWebhookType = event.type;
          s.lastWebhookResult = result;
        });
        res.json({ received: true, result });
      } catch (error) {
        console.error("Stripe webhook failed", event.type, error);
        res.status(500).send("Webhook handling failed."); // Stripe retries
      }
    });
  }

  // --- Routes -------------------------------------------------------------

  function mountRoutes(app) {
    // ---------- Member portal ----------

    app.post("/api/members/login", async (req, res) => {
      const email = normalizeEmail(req.body?.email);
      const generic = { ok: true, message: "If that email belongs to a member, a sign-in link is on its way." };
      if (!email.includes("@")) return res.status(400).json({ ok: false, error: "Please enter your email." });
      if (!allowMemberLogin(`${req.ip}|${email}`)) {
        return res.status(429).json({ ok: false, error: "Too many attempts. Please try again in a few minutes." });
      }

      const { members: list } = await members.read();
      const member = list.find((m) => m.email === email);
      if (canUsePortal(member)) {
        const token = auth.sign({ t: "signin", mid: member.id }, SIGN_IN_LINK_SECONDS);
        await sendEmail({
          to: member.email,
          subject: "Your Ladies On The Green sign-in link",
          text: [
            `Hi ${firstName(member.name)},`,
            "",
            "Use this link to sign in to the Ladies On The Green member portal. It works for 30 minutes.",
            "",
            `${origin(req)}/api/members/verify?token=${encodeURIComponent(token)}`,
            "",
            "If you didn't ask to sign in, you can ignore this email.",
            "",
            "Ladies On The Green"
          ].join("\n")
        });
      } else if (member?.status === "registered") {
        await sendEmail(reminderEmail(member, req));
      }
      res.json(generic);
    });

    app.get("/api/members/verify", async (req, res) => {
      const payload = auth.verify(String(req.query.token || ""), "signin");
      const { members: list } = await members.read();
      const member = payload && list.find((m) => m.id === payload.mid);
      if (!canUsePortal(member)) return res.redirect("/members?signin=expired");
      setCookie(req, res, MEMBER_COOKIE, auth.sign({ t: "member", mid: member.id }, MEMBER_SESSION_SECONDS), MEMBER_SESSION_SECONDS);
      await members.update((data) => {
        const m = data.members.find((x) => x.id === member.id);
        if (m) m.lastLoginAt = new Date().toISOString();
      });
      res.redirect("/members");
    });

    app.post("/api/members/logout", (req, res) => {
      clearCookie(req, res, MEMBER_COOKIE);
      res.json({ ok: true });
    });

    app.get("/api/members/me", requireMember, (req, res) => {
      res.json({ ok: true, member: portalView(req.member) });
    });

    app.put("/api/members/me/directory", requireMember, async (req, res) => {
      const body = req.body || {};
      const linkedin = clean(body.linkedin, 300);
      if (linkedin && !isHttpUrl(linkedin)) {
        return res.status(400).json({ ok: false, error: "LinkedIn should be a full link starting with https://" });
      }
      const directory = {
        optIn: Boolean(body.optIn),
        headline: clean(body.headline, 120),
        company: clean(body.company, 120),
        location: clean(body.location, 120),
        linkedin,
        showEmail: Boolean(body.showEmail)
      };
      await members.update((data) => {
        const m = data.members.find((x) => x.id === req.member.id);
        if (m) m.directory = directory;
      });
      res.json({ ok: true, directory });
    });

    app.get("/api/members/offers", requireMember, async (_req, res) => {
      const today = new Date().toISOString().slice(0, 10);
      const { offers: list } = await offers.read();
      res.json({
        ok: true,
        offers: list
          .filter((o) => o.active && (!o.expiresOn || o.expiresOn >= today))
          .sort((a, b) => (a.eventDate || a.createdAt).localeCompare(b.eventDate || b.createdAt))
      });
    });

    app.get("/api/members/directory", requireMember, async (_req, res) => {
      const { members: list } = await members.read();
      res.json({
        ok: true,
        members: list
          .filter((m) => canUsePortal(m) && m.directory?.optIn)
          .map(directoryView)
          .sort((a, b) => a.name.localeCompare(b.name))
      });
    });

    app.post("/api/members/billing", requireMember, async (req, res) => {
      if (!stripe || !req.member.stripeCustomerId) {
        return res.status(400).json({ ok: false, error: "Billing isn't available online yet. Please email hello@ladiesonthegreen.com." });
      }
      try {
        const session = await stripe.billingPortal.sessions.create({
          customer: req.member.stripeCustomerId,
          return_url: `${origin(req)}/members`
        });
        res.json({ ok: true, url: session.url });
      } catch (error) {
        console.error("Billing portal failed", error);
        res.status(500).json({ ok: false, error: "Billing is temporarily unavailable. Please email hello@ladiesonthegreen.com." });
      }
    });

    // ---------- Admin ----------

    app.post("/api/admin/login", (req, res) => {
      if (!adminPassword) {
        return res.status(500).json({ ok: false, error: "Set ADMIN_PASSWORD on the server to enable the dashboard." });
      }
      if (!allowAdminLogin(req.ip)) {
        return res.status(429).json({ ok: false, error: "Too many attempts. Please wait 15 minutes." });
      }
      if (!safeEqual(req.body?.password || "", adminPassword)) {
        return res.status(401).json({ ok: false, error: "Incorrect password." });
      }
      setCookie(req, res, ADMIN_COOKIE, auth.sign({ t: "admin" }, ADMIN_SESSION_SECONDS), ADMIN_SESSION_SECONDS);
      res.json({ ok: true });
    });

    app.post("/api/admin/logout", (req, res) => {
      clearCookie(req, res, ADMIN_COOKIE);
      res.json({ ok: true });
    });

    app.get("/api/admin/session", requireAdmin, (_req, res) => res.json({ ok: true }));

    app.get("/api/admin/status", requireAdmin, async (_req, res) => {
      res.json({
        ok: true,
        stripeConfigured: Boolean(stripe),
        webhookConfigured: Boolean(webhookSecret),
        mailConfigured: mailConfigured(),
        separateAdminPassword: Boolean(process.env.ADMIN_PASSWORD),
        ...(await stripeStatus.read())
      });
    });

    app.get("/api/admin/members", requireAdmin, async (_req, res) => {
      const { members: list } = await members.read();
      const soon = Date.now() + 30 * 24 * 60 * 60 * 1000;
      const active = list.filter((m) => m.status === "active");
      res.json({
        ok: true,
        members: list.sort((a, b) => b.registeredAt.localeCompare(a.registeredAt)),
        stats: {
          total: list.length,
          active: active.length,
          registered: list.filter((m) => m.status === "registered").length,
          pastDue: list.filter((m) => m.status === "past_due").length,
          canceled: list.filter((m) => m.status === "canceled").length,
          annualRevenue: active.reduce((sum, m) => sum + (m.plan?.amount || 0) * (m.plan?.interval === "month" ? 12 : 1), 0),
          renewingSoon: active.filter((m) => m.paidThrough && Date.parse(m.paidThrough) < soon && !m.cancelAtPeriodEnd).length
        }
      });
    });

    app.patch("/api/admin/members/:id", requireAdmin, async (req, res) => {
      const body = req.body || {};
      if (body.status && !MEMBER_STATUSES.includes(body.status)) {
        return res.status(400).json({ ok: false, error: "Unknown status." });
      }
      const updated = await members.update((data) => {
        const m = data.members.find((x) => x.id === req.params.id);
        if (!m) return null;
        if (typeof body.notes === "string") m.notes = clean(body.notes, 4000);
        if (body.status && body.status !== m.status) {
          m.status = body.status;
          // Marking someone paid by hand (cash, check, comp) gives them a year.
          if (body.status === "active") {
            if (!m.activatedAt) m.activatedAt = new Date().toISOString();
            if (!m.plan) m.plan = { amount: m.rateAtSignup || currentRate().amount, interval: "year" };
            if (!m.paidThrough || Date.parse(m.paidThrough) < Date.now()) {
              const until = new Date();
              until.setFullYear(until.getFullYear() + 1);
              m.paidThrough = until.toISOString();
            }
          }
        }
        m.updatedAt = new Date().toISOString();
        return m;
      });
      if (!updated) return res.status(404).json({ ok: false, error: "Member not found." });
      res.json({ ok: true, member: updated });
    });

    app.delete("/api/admin/members/:id", requireAdmin, async (req, res) => {
      const removed = await members.update((data) => {
        const before = data.members.length;
        data.members = data.members.filter((m) => m.id !== req.params.id);
        return data.members.length < before;
      });
      if (!removed) return res.status(404).json({ ok: false, error: "Member not found." });
      res.json({ ok: true });
    });

    app.post("/api/admin/members/:id/remind", requireAdmin, async (req, res) => {
      const { members: list } = await members.read();
      const member = list.find((m) => m.id === req.params.id);
      if (!member) return res.status(404).json({ ok: false, error: "Member not found." });
      if (member.status !== "registered") {
        return res.status(400).json({ ok: false, error: "Reminders are only for people who haven't paid." });
      }
      try {
        await sendReminder(member, req);
        res.json({ ok: true });
      } catch (error) {
        console.error("Reminder failed", error);
        res.status(500).json({ ok: false, error: "The email could not be sent." });
      }
    });

    // Remind everyone who hasn't paid and wasn't reminded in the last few days.
    app.post("/api/admin/remind-unpaid", requireAdmin, async (req, res) => {
      const skipDays = Number(req.body?.skipDays ?? 3);
      const cutoff = Date.now() - skipDays * 24 * 60 * 60 * 1000;
      const { members: list } = await members.read();
      const due = list.filter(
        (m) => m.status === "registered" && (!m.reminders?.lastAt || Date.parse(m.reminders.lastAt) < cutoff)
      );
      let sent = 0;
      const failed = [];
      for (const member of due) {
        try {
          await sendReminder(member, req);
          sent += 1;
        } catch (error) {
          console.error("Reminder failed", member.email, error);
          failed.push(member.email);
        }
      }
      res.json({ ok: true, sent, failed, skipped: list.filter((m) => m.status === "registered").length - due.length });
    });

    app.get("/api/admin/members.csv", requireAdmin, async (_req, res) => {
      const { members: list } = await members.read();
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="lotg-members-${new Date().toISOString().slice(0, 10)}.csv"`);
      res.send(
        csv(list, [
          { label: "Name", value: (m) => m.name },
          { label: "Email", value: (m) => m.email },
          { label: "Phone", value: (m) => m.phone },
          { label: "Status", value: (m) => m.status },
          { label: "Plan", value: (m) => (m.plan ? `$${m.plan.amount}/${m.plan.interval || "year"}` : "") },
          { label: "Registered", value: (m) => m.registeredAt?.slice(0, 10) },
          { label: "Activated", value: (m) => m.activatedAt?.slice(0, 10) },
          { label: "Paid through", value: (m) => m.paidThrough?.slice(0, 10) },
          { label: "Cancels at period end", value: (m) => (m.cancelAtPeriodEnd ? "yes" : "") },
          { label: "Address", value: (m) => [m.address, m.address2].filter(Boolean).join(", ") },
          { label: "City", value: (m) => m.city },
          { label: "State", value: (m) => m.state },
          { label: "Zip", value: (m) => m.zip },
          { label: "Country", value: (m) => m.country },
          { label: "Reminders sent", value: (m) => m.reminders?.count || 0 },
          { label: "Notes", value: (m) => m.notes }
        ])
      );
    });

    app.get("/api/admin/registrations", requireAdmin, async (_req, res) => {
      const { registrations: list } = await registrations.read();
      res.json({ ok: true, registrations: list.sort((a, b) => (b.paidAt || "").localeCompare(a.paidAt || "")) });
    });

    app.get("/api/admin/registrations.csv", requireAdmin, async (_req, res) => {
      const { registrations: list } = await registrations.read();
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="lotg-event-registrations-${new Date().toISOString().slice(0, 10)}.csv"`);
      res.send(
        csv(list, [
          { label: "Event", value: (r) => r.event },
          { label: "Name", value: (r) => r.name },
          { label: "Email", value: (r) => r.email },
          { label: "Phone", value: (r) => r.phone },
          { label: "Tickets", value: (r) => r.quantity },
          { label: "Amount", value: (r) => r.amount },
          { label: "Paid", value: (r) => r.paidAt?.slice(0, 10) }
        ])
      );
    });

    // ---------- Offers ----------

    function offerFromBody(body) {
      const offer = {
        title: clean(body.title, 120),
        description: clean(body.description, 1500),
        category: OFFER_CATEGORIES.includes(body.category) ? body.category : "Offer",
        code: clean(body.code, 60),
        link: clean(body.link, 500),
        eventDate: /^\d{4}-\d{2}-\d{2}$/.test(body.eventDate || "") ? body.eventDate : "",
        expiresOn: /^\d{4}-\d{2}-\d{2}$/.test(body.expiresOn || "") ? body.expiresOn : "",
        active: body.active !== false
      };
      if (!offer.title) return { error: "Please add a title." };
      if (offer.link && !isHttpUrl(offer.link)) return { error: "Links must start with https://" };
      return { offer };
    }

    app.get("/api/admin/offers", requireAdmin, async (_req, res) => {
      const { offers: list } = await offers.read();
      res.json({ ok: true, offers: list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
    });

    app.post("/api/admin/offers", requireAdmin, async (req, res) => {
      const { offer, error } = offerFromBody(req.body || {});
      if (error) return res.status(400).json({ ok: false, error });
      const created = { id: crypto.randomUUID(), ...offer, createdAt: new Date().toISOString() };
      await offers.update((data) => {
        data.offers.push(created);
      });
      res.json({ ok: true, offer: created });
    });

    app.put("/api/admin/offers/:id", requireAdmin, async (req, res) => {
      const { offer, error } = offerFromBody(req.body || {});
      if (error) return res.status(400).json({ ok: false, error });
      const updated = await offers.update((data) => {
        const existing = data.offers.find((o) => o.id === req.params.id);
        if (!existing) return null;
        Object.assign(existing, offer, { updatedAt: new Date().toISOString() });
        return existing;
      });
      if (!updated) return res.status(404).json({ ok: false, error: "Offer not found." });
      res.json({ ok: true, offer: updated });
    });

    app.delete("/api/admin/offers/:id", requireAdmin, async (req, res) => {
      await offers.update((data) => {
        data.offers = data.offers.filter((o) => o.id !== req.params.id);
      });
      res.json({ ok: true });
    });

    // ---------- Announcements ----------

    app.get("/api/admin/announcements", requireAdmin, async (_req, res) => {
      const { announcements: list } = await announcements.read();
      res.json({ ok: true, announcements: list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
    });

    // Sends in the background (one email per member) so a large list never
    // times out the request; progress shows in the announcement history.
    app.post("/api/admin/announcements", requireAdmin, async (req, res) => {
      const subject = clean(req.body?.subject, 200);
      const message = clean(req.body?.message, 10000);
      if (!subject || !message) return res.status(400).json({ ok: false, error: "Add a subject and a message." });

      const { members: list } = await members.read();
      const recipients = list.filter(canUsePortal);
      if (!recipients.length) return res.status(400).json({ ok: false, error: "There are no active members to email yet." });

      const record = {
        id: crypto.randomUUID(),
        subject,
        message,
        createdAt: new Date().toISOString(),
        recipients: recipients.length,
        sent: 0,
        failed: 0,
        status: "sending"
      };
      await announcements.update((data) => {
        data.announcements.push(record);
      });
      res.json({ ok: true, announcement: record });

      const portalUrl = `${origin(req)}/members`;
      (async () => {
        let sent = 0;
        let failed = 0;
        for (const member of recipients) {
          try {
            await sendEmail({
              to: member.email,
              subject,
              text: `Hi ${firstName(member.name)},\n\n${message}\n\nSee your member offers: ${portalUrl}\n\nLadies On The Green`
            });
            sent += 1;
          } catch (error) {
            console.error("Announcement email failed", member.email, error);
            failed += 1;
          }
          await new Promise((resolve) => setTimeout(resolve, 250)); // gentle on the mail server
        }
        await announcements.update((data) => {
          const a = data.announcements.find((x) => x.id === record.id);
          if (a) Object.assign(a, { sent, failed, status: "done", finishedAt: new Date().toISOString() });
        });
      })().catch((error) => console.error("Announcement run failed", error));
    });

    // ---------- Stripe backfill ----------

    app.post("/api/admin/stripe/sync", requireAdmin, async (_req, res) => {
      if (!sync) return res.status(400).json({ ok: false, error: "Add STRIPE_SECRET_KEY on the server first." });
      try {
        const result = await sync.syncAll();
        await stripeStatus.update((s) => {
          s.lastSyncAt = new Date().toISOString();
          s.lastSyncResult = result;
        });
        res.json({ ok: true, result });
      } catch (error) {
        console.error("Stripe sync failed", error);
        res.status(500).json({ ok: false, error: `Stripe sync failed: ${error.message}` });
      }
    });
  }

  return {
    recordApplication,
    mountWebhook,
    mountRoutes,
    requireAdmin,
    stripe,
    addWebhookHandler: (handler) => webhookHandlers.push(handler)
  };
}
