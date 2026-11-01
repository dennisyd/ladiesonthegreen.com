import crypto from "node:crypto";
import path from "node:path";
import { jsonStore } from "./store.js";
import { createRateLimiter } from "./auth.js";

export function mountMagazineList(app, dataDir, requireAdmin) {
  const store = jsonStore(path.join(dataDir, "magazine-list.json"), { subscribers: [] });
  const allow = createRateLimiter(10, 60 * 60 * 1000);
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
        data.subscribers.push({ id: crypto.randomUUID(), firstName: firstName.trim(), lastName: lastName.trim(), email: normalizedEmail, joinedAt: new Date().toISOString(), source: "subscribe", interest: "The Collective Magazine launch — $19.99/year, four quarterly digital issues; no payment collected" });
      });
      res.json({ ok: true, message: "You’re on the list! We’ll email you when subscriptions open. No payment has been collected." });
    } catch (error) {
      console.error("Could not save magazine subscription interest", error);
      res.status(500).json({ error: "We could not save your details. Please try again." });
    }
  });
  app.get("/api/admin/magazine-list", requireAdmin, async (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.json({ subscribers: (await store.read()).subscribers.slice().reverse() });
  });
}
