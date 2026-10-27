import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import multer from "multer";
import { jsonStore } from "./store.js";

// Member events shown in the portal. Managed in /admin → Portal events.
//
// status "published" events appear in the portal until their date has passed;
// "archived" events are hidden but kept so they can be restored or reused.

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const LOCAL_IMAGE = /^\/uploads\/events\/[A-Za-z0-9_.-]+$/;

export const clean = (value, max) => String(value ?? "").trim().slice(0, max);

// Today's date in the club's time zone, as YYYY-MM-DD.
export const todayEastern = (now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);

const MODES = ["exact", "month", "year", "tba"];
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const YEAR = /^\d{4}$/;

// How the date is given: an exact day, just a month, just a year, or "to be
// announced". Events saved before this existed have no mode: a date means exact,
// no date means to be announced.
export const modeOf = (e) => (MODES.includes(e.dateMode) ? e.dateMode : e.date ? "exact" : "tba");

// The last day an event still counts as upcoming; null for to-be-announced
// events, which stay up until the admin gives them a date, archives or deletes them.
export function endDateOf(e) {
  const mode = modeOf(e);
  if (mode === "exact") return e.date;
  if (mode === "month") {
    const [year, month] = e.date.split("-").map(Number);
    return `${e.date}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, "0")}`;
  }
  if (mode === "year") return `${e.date}-12-31`;
  return null;
}

export const isPast = (e, today = todayEastern()) => {
  const end = endDateOf(e);
  return end !== null && end < today;
};

// Where an event sits in the list: by the end of its period, so a vague
// "April 2027" or "2027" comes after the exact dates inside it; to be announced last.
const MODE_RANK = { exact: 0, month: 1, year: 2, tba: 3 };
const sortKey = (e) => endDateOf(e) ?? "9999-12-31";

const isRealDate = (value) => DATE.test(value) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;

export function httpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function validateEvent(body) {
  const event = {
    title: clean(body.title, 120),
    date: clean(body.date, 10),
    startTime: clean(body.startTime, 5),
    endTime: clean(body.endTime, 5),
    location: clean(body.location, 160),
    description: clean(body.description, 3000),
    link: clean(body.link, 500),
    linkLabel: clean(body.linkLabel, 40),
    image: clean(body.image, 500)
  };
  event.dateMode = MODES.includes(body.dateMode) ? body.dateMode : "exact";
  event.locationTbd = body.locationTbd === true || body.locationTbd === "true";
  if (event.locationTbd) event.location = "";
  if (!event.title) return { error: "Please add a title." };
  if (event.dateMode === "exact" && !isRealDate(event.date)) return { error: "Please choose the event date." };
  if (event.dateMode === "month" && !MONTH.test(event.date)) return { error: "Please choose the month and year." };
  if (event.dateMode === "year" && !(YEAR.test(event.date) && event.date >= "2000" && event.date <= "2100")) {
    return { error: "Please choose the year." };
  }
  if (event.dateMode === "tba") event.date = "";
  // Times only make sense for an exact date.
  if (event.dateMode !== "exact") {
    event.startTime = "";
    event.endTime = "";
  }
  if (event.startTime && !TIME.test(event.startTime)) return { error: "The start time isn't valid." };
  if (event.endTime && !TIME.test(event.endTime)) return { error: "The end time isn't valid." };
  if (event.endTime && !event.startTime) return { error: "Add a start time before adding an end time." };
  if (event.endTime && event.endTime <= event.startTime) return { error: "The end time must be after the start time." };
  if (event.link && !httpsUrl(event.link)) return { error: "The link must start with https://" };
  if (event.link && !event.linkLabel) event.linkLabel = "RSVP & details";
  if (!event.link) event.linkLabel = "";
  if (event.image && !LOCAL_IMAGE.test(event.image) && !httpsUrl(event.image)) {
    return { error: "The photo must be an uploaded photo or an https:// image address." };
  }
  return { event };
}

export const byDate = (a, b) =>
  sortKey(a).localeCompare(sortKey(b)) ||
  MODE_RANK[modeOf(a)] - MODE_RANK[modeOf(b)] ||
  (a.startTime || "").localeCompare(b.startTime || "");

const memberView = (e) => ({
  id: e.id,
  title: e.title,
  dateMode: modeOf(e),
  date: e.date,
  startTime: e.startTime,
  endTime: e.endTime,
  location: e.location,
  locationTbd: Boolean(e.locationTbd),
  description: e.description,
  link: e.link,
  linkLabel: e.linkLabel,
  image: e.image,
  featured: Boolean(e.featured)
});

export function createMemberEvents(dataDir, { requireAdmin, requireMember }) {
  const store = jsonStore(path.join(dataDir, "events.json"), { events: [] });
  const uploadDir = path.join(dataDir, "..", "uploads", "events");
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });

  // Delete an uploaded photo from disk once no event uses it any more.
  async function dropImage(url, data) {
    if (!url || !LOCAL_IMAGE.test(url) || data.events.some((e) => e.image === url)) return;
    await fs.unlink(path.join(uploadDir, path.basename(url))).catch(() => {});
  }

  // One-time move of "Event" entries from the old offers list into events.
  async function importFromOffers(offers) {
    const { offers: list } = await offers.read();
    const legacy = list.filter((o) => o.category === "Event");
    if (!legacy.length) return 0;
    await store.update((data) => {
      for (const o of legacy) {
        if (data.events.some((e) => e.id === o.id)) continue;
        const date = DATE.test(o.eventDate || "") ? o.eventDate : DATE.test(o.expiresOn || "") ? o.expiresOn : "";
        data.events.push({
          id: o.id,
          title: clean(o.title, 120),
          dateMode: date ? "exact" : "tba",
          date,
          startTime: "",
          endTime: "",
          location: "",
          locationTbd: false,
          description: clean(o.description, 3000),
          link: httpsUrl(o.link || "") ? o.link : "",
          linkLabel: httpsUrl(o.link || "") ? "RSVP & details" : "",
          image: "",
          status: o.active !== false ? "published" : "archived",
          createdAt: o.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    });
    await offers.update((data) => {
      data.offers = data.offers.filter((o) => o.category !== "Event");
    });
    return legacy.length;
  }

  function mountRoutes(app) {
    // ---------- Members ----------

    app.get("/api/members/events", requireMember, async (_req, res) => {
      const today = todayEastern();
      const { events } = await store.read();
      res.json({
        ok: true,
        events: events
          .filter((e) => e.status === "published" && !isPast(e, today))
          .sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || byDate(a, b))
          .map(memberView)
      });
    });

    // ---------- Admin ----------

    app.get("/api/admin/events", requireAdmin, async (_req, res) => {
      const { events } = await store.read();
      const today = todayEastern();
      res.json({
        ok: true,
        today,
        events: events.sort(byDate).map((e) => ({ ...e, dateMode: modeOf(e), locationTbd: Boolean(e.locationTbd), isPast: isPast(e, today) }))
      });
    });

    app.post("/api/admin/events", requireAdmin, async (req, res) => {
      const { event, error } = validateEvent(req.body || {});
      if (error) return res.status(400).json({ ok: false, error });
      const now = new Date().toISOString();
      const created = { id: crypto.randomUUID(), ...event, featured: false, status: "published", createdAt: now, updatedAt: now };
      await store.update((data) => {
        data.events.push(created);
      });
      res.json({ ok: true, event: created });
    });

    app.put("/api/admin/events/:id", requireAdmin, async (req, res) => {
      const { event, error } = validateEvent(req.body || {});
      if (error) return res.status(400).json({ ok: false, error });
      const updated = await store.update(async (data) => {
        const existing = data.events.find((e) => e.id === req.params.id);
        if (!existing) return null;
        const oldImage = existing.image;
        Object.assign(existing, event, { updatedAt: new Date().toISOString() });
        if (isPast(existing, todayEastern())) existing.featured = false;
        if (oldImage !== existing.image) await dropImage(oldImage, data);
        return existing;
      });
      if (!updated) return res.status(404).json({ ok: false, error: "Event not found." });
      res.json({ ok: true, event: updated });
    });

    // Archive (hide, keep) or restore (show again).
    app.patch("/api/admin/events/:id/status", requireAdmin, async (req, res) => {
      const status = req.body?.status;
      if (status !== "published" && status !== "archived") {
        return res.status(400).json({ ok: false, error: "Status must be published or archived." });
      }
      const updated = await store.update((data) => {
        const existing = data.events.find((e) => e.id === req.params.id);
        if (!existing) return null;
        existing.status = status;
        if (status === "archived") existing.featured = false;
        existing.updatedAt = new Date().toISOString();
        return existing;
      });
      if (!updated) return res.status(404).json({ ok: false, error: "Event not found." });
      res.json({ ok: true, event: updated });
    });

    app.patch("/api/admin/events/:id/featured", requireAdmin, async (req, res) => {
      if (typeof req.body?.featured !== "boolean") {
        return res.status(400).json({ ok: false, error: "Featured must be true or false." });
      }
      const result = await store.update((data) => {
        const existing = data.events.find((e) => e.id === req.params.id);
        if (!existing) return { error: "Event not found.", status: 404 };
        if (req.body.featured && (existing.status !== "published" || isPast(existing, todayEastern()))) {
          return { error: "Only a published upcoming event can be featured.", status: 400 };
        }
        const now = new Date().toISOString();
        if (req.body.featured) {
          for (const event of data.events) {
            if (event.featured) {
              event.featured = false;
              event.updatedAt = now;
            }
          }
        }
        existing.featured = req.body.featured;
        existing.updatedAt = now;
        return { event: existing };
      });
      if (result.error) return res.status(result.status).json({ ok: false, error: result.error });
      res.json({ ok: true, event: result.event });
    });

    app.delete("/api/admin/events/:id", requireAdmin, async (req, res) => {
      const removed = await store.update(async (data) => {
        const existing = data.events.find((e) => e.id === req.params.id);
        if (!existing) return false;
        data.events = data.events.filter((e) => e.id !== req.params.id);
        await dropImage(existing.image, data);
        return true;
      });
      if (!removed) return res.status(404).json({ ok: false, error: "Event not found." });
      res.json({ ok: true });
    });

    app.post("/api/admin/events/image", requireAdmin, (req, res) => {
      upload.single("image")(req, res, async (err) => {
        if (err) return res.status(400).json({ ok: false, error: "Choose one photo under 5 MB." });
        const file = req.file;
        const b = file?.buffer;
        const ext = !b
          ? null
          : b.subarray(0, 3).equals(Buffer.from([255, 216, 255]))
            ? "jpg"
            : b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
              ? "png"
              : b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP"
                ? "webp"
                : null;
        if (!ext) return res.status(400).json({ ok: false, error: "Choose a JPG, PNG, or WebP photo." });
        try {
          await fs.mkdir(uploadDir, { recursive: true });
          const name = `${crypto.randomUUID()}.${ext}`;
          await fs.writeFile(path.join(uploadDir, name), b);
          res.json({ ok: true, image: `/uploads/events/${name}` });
        } catch {
          res.status(500).json({ ok: false, error: "The photo could not be saved. Please try again." });
        }
      });
    });
  }

  return { mountRoutes, importFromOffers };
}
