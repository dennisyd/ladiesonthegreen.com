import crypto from "node:crypto";
import path from "node:path";
import { jsonStore } from "./store.js";
import { createRateLimiter } from "./auth.js";
import { createTransporter, mailFrom, contactTo } from "./mailer.js";

export function mountMagazineList(app, dataDir, requireAdmin, { getTransporter = createTransporter, from = mailFrom, replyTo = contactTo } = {}) {
  const store = jsonStore(path.join(dataDir, "magazine-list.json"), { subscribers: [] });
  const allow = createRateLimiter(10, 60 * 60 * 1000);
  let sending = false;
  const ready = store.update((data) => {
    data.mailings ??= [];
    for (const mailing of data.mailings) if (mailing.status === "sending") mailing.status = "interrupted";
  });
  const configured = () => { const transport = getTransporter(); const ok = Boolean(transport && from); transport?.close?.(); return ok; };
  app.post("/api/magazine-list", async (req, res) => {
    res.set("Cache-Control", "no-store");
    if (!allow(req.ip)) return res.status(429).json({ error: "Too many attempts. Please try again in an hour." });
    const { firstName, lastName, email, website } = req.body || {};
    if (typeof firstName !== "string" || !firstName.trim() || firstName.length > 80 || typeof lastName !== "string" || !lastName.trim() || lastName.length > 80) return res.status(400).json({ error: "Please enter your first and last name (up to 80 characters each)." });
    if (typeof email !== "string" || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return res.status(400).json({ error: "Please enter a valid email address." });
    if (website) return res.status(400).json({ error: "We could not add you to the list. Please try again." });
    const normalizedEmail = email.trim().toLowerCase();
    try {
      await store.update((data) => {
        if (data.subscribers.some((s) => s.email === normalizedEmail)) return;
        data.subscribers.push({ id: crypto.randomUUID(), firstName: firstName.trim(), lastName: lastName.trim(), email: normalizedEmail, joinedAt: new Date().toISOString(), unsubscribeToken: crypto.randomBytes(24).toString("hex"), source: "subscribe", interest: "The Collective Magazine launch — $19.99/year, four quarterly digital issues; no payment collected" });
      });
      res.json({ ok: true, message: "You’re on the list! We’ll email you when subscriptions open. No payment has been collected." });
    } catch (error) {
      console.error("Could not save magazine subscription interest", error);
      res.status(500).json({ error: "We could not save your details. Please try again." });
    }
  });
  app.get("/api/admin/magazine-list", requireAdmin, async (_req, res) => {
    await ready;
    res.set("Cache-Control", "no-store");
    const data = await store.read();
    res.json({ subscribers: data.subscribers.slice().reverse(), mailings: data.mailings.slice().reverse(), emailConfigured: configured() });
  });
  app.delete("/api/admin/magazine-list/:id", requireAdmin, async (req, res) => {
    const found = await store.update((data) => {
      const index = data.subscribers.findIndex((s) => s.id === req.params.id);
      if (index < 0) return false;
      data.subscribers.splice(index, 1); return true;
    });
    res.status(found ? 200 : 404).json(found ? { ok: true } : { error: "Subscriber not found." });
  });
  app.get("/api/magazine-list/unsubscribe/:token", async (req, res) => {
    res.set("Cache-Control", "no-store");
    const exists = (await store.read()).subscribers.some((s) => s.unsubscribeToken === req.params.token);
    res.type("html").send(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>The Collective — Email preferences</title><body style="font-family:Georgia,serif;background:#fbfaf5;color:#0a3d2a;max-width:600px;margin:70px auto;padding:24px"><h1>The Collective Magazine</h1>${exists ? '<p>Stop receiving magazine launch and subscription updates?</p><form method="post"><button type="submit" style="padding:14px 24px;background:#0a3d2a;color:white;border:0;border-radius:8px">Unsubscribe</button></form>' : '<p>You are no longer on this email list.</p>'}</body></html>`);
  });
  app.post("/api/magazine-list/unsubscribe/:token", async (req, res) => {
    await store.update((data) => { data.subscribers = data.subscribers.filter((s) => s.unsubscribeToken !== req.params.token); });
    res.set("Cache-Control", "no-store").type("html").send('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Unsubscribed</title><body style="font-family:Georgia,serif;background:#fbfaf5;color:#0a3d2a;max-width:600px;margin:70px auto;padding:24px"><h1>You’re unsubscribed.</h1><p>You will no longer receive updates from The Collective magazine list.</p><a href="/magazine">Back to the magazine</a></body></html>');
  });
  app.post("/api/admin/magazine-list/email", requireAdmin, async (req, res) => {
    await ready;
    const { subject, message, subscriberIds, requestId } = req.body || {};
    if (typeof subject !== "string" || !subject.trim() || subject.length > 200 || /[\r\n]/.test(subject) || typeof message !== "string" || !message.trim() || message.length > 10000) return res.status(400).json({ error: "Add a subject (up to 200 characters) and message (up to 10,000 characters)." });
    if (!Array.isArray(subscriberIds) || !subscriberIds.length || subscriberIds.length > 1000 || subscriberIds.some((id) => typeof id !== "string") || typeof requestId !== "string" || !/^[a-f0-9-]{36}$/i.test(requestId)) return res.status(400).json({ error: "Choose 1–1,000 subscribers and preview your email first." });
    if (sending) return res.status(409).json({ error: "An email batch is already sending. Please wait for it to finish." });
    sending = true;
    let transport;
    try {
      const data = await store.read();
      const existing = data.mailings.find((m) => m.id === requestId);
      if (existing) { sending = false; return res.json({ ok: true, mailing: existing }); }
      const ids = new Set(subscriberIds);
      const recipients = data.subscribers.filter((s) => ids.has(s.id));
      if (recipients.length !== ids.size) { sending = false; return res.status(400).json({ error: "Some selected subscribers are no longer on the list. Refresh and preview again." }); }
      transport = getTransporter();
      if (!transport || !from) { transport?.close?.(); sending = false; return res.status(503).json({ error: "Email is not configured on the server. Set up SMTP before sending." }); }
      const origin = new URL(process.env.SITE_URL || "https://ladiesonthegreen.com").origin;
      const mailing = { id: requestId, subject: subject.trim(), message: message.trim(), createdAt: new Date().toISOString(), status: "sending", recipients: recipients.map((s) => ({ id: s.id, status: "pending" })) };
      await store.update((current) => {
        for (const s of current.subscribers) if (!s.unsubscribeToken) s.unsubscribeToken = crypto.randomBytes(24).toString("hex");
        current.mailings.push(mailing);
      });
      res.status(202).json({ ok: true, mailing });
      (async () => {
        try {
          for (const recipient of recipients) {
            const current = (await store.read()).subscribers.find((s) => s.id === recipient.id);
            let status = "skipped";
            if (current) {
              try {
                const unsubscribe = `${origin}/api/magazine-list/unsubscribe/${current.unsubscribeToken}`;
                const result = await transport.sendMail({ to: current.email, from, replyTo,
                  subject: mailing.subject,
                  text: `Hi ${current.firstName},\n\n${mailing.message}\n\nThe Collective Magazine\nLadies On The Green\n\nYou joined our magazine launch and subscription list.\nUnsubscribe: ${unsubscribe}` });
                status = result?.rejected?.length ? "failed" : "sent";
              } catch { status = "failed"; }
            }
            await store.update((d) => { d.mailings.find((m) => m.id === requestId).recipients.find((r) => r.id === recipient.id).status = status; });
          }
          await store.update((d) => { Object.assign(d.mailings.find((m) => m.id === requestId), { status: "done", finishedAt: new Date().toISOString() }); });
        } catch (error) {
          console.error("Magazine email batch interrupted", error);
          await store.update((d) => { d.mailings.find((m) => m.id === requestId).status = "interrupted"; }).catch(() => {});
        } finally { transport.close?.(); sending = false; }
      })();
    } catch (error) {
      transport?.close?.(); sending = false;
      console.error("Could not start magazine email batch", error);
      if (!res.headersSent) res.status(500).json({ error: "Could not start sending. Please refresh the list and try again." });
    }
  });
}
