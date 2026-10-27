import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import multer from "multer";
import { byDate, clean, httpsUrl, isPast, modeOf, todayEastern, validateEvent } from "./member-events.js";
import { jsonStore } from "./store.js";

// Events shown on the public website (/events and the home page). Managed in
// /admin → Site events, so adding one needs no rebuild. Separate from the member
// portal events in member-events.js, though the date rules are shared.
//
// The first time the site runs, the events that used to be written into the page
// code are loaded here so they can be edited like any other.

const GOLF_REGISTRATION = "https://buy.stripe.com/cNibJ17EndPy1f165cdby0A";
const LOCAL_IMAGE = /^\/(uploads\/site-events\/)?[A-Za-z0-9_.-]+\.(jpg|jpeg|png|webp)$/;
const FIRST_RUN = "2026-01-01T00:00:00.000Z";

const seed = (id, fields) => ({
  id, dateMode: "exact", endTime: "", locationTbd: false, link: "", linkLabel: "", pastNote: "", tallImage: true,
  status: "published", createdAt: FIRST_RUN, updatedAt: FIRST_RUN, ...fields
});

const MV_TEXT =
  "Whether you’re new to golf or an experienced player, come practice at the driving range, sharpen your swing, and connect with an amazing community of women who share a passion for golf, friendship, and networking. Range balls and any golf fees are the responsibility of each participant.";

const SEED_EVENTS = [
  seed("seed-private-club-golf", {
    title: "Private Club Golf Experience",
    tagline: "Learn · Play · Connect — small group instruction with 2 PGA-certified pros",
    date: "2026-10-03", startTime: "13:00",
    location: "Country Club at Woodmore — 12320 Pleasant Prospect Road, Mitchellville, MD 20721",
    extraDetails: "$79 per person · All skill levels welcome · Clubs provided · Limited to 20 spots",
    description:
      "A curated golf clinic in a private country club setting, designed to help you learn, improve your game, and make meaningful connections. Includes PGA-certified instruction, a networking reception afterward with drinks and conversation, and access to a beautiful private course.",
    link: GOLF_REGISTRATION, linkLabel: "Reserve Your Spot — $79 ↘",
    image: "/private-club-golf-experience.jpg"
  }),
  seed("seed-nyfw-glitz-and-glam", {
    title: "NYFW Weekend — Glitz & Glam Runway Extravaganza",
    tagline: "Network · Empower · Give Back · Shine — where style meets purpose",
    date: "2026-09-12", startTime: "20:00",
    location: "Léman Ballroom — 41 Broad Street, New York, NY 10004",
    extraDetails: "EPN NYFW Runway Extravaganza · High fashion, bold beauty, lasting impact",
    description:
      "Ladies On The Green took over New York Fashion Week weekend with a night of high fashion, connection, and purpose at the EPN NYFW Glitz & Glam Runway Extravaganza — more than fashion, a movement.",
    image: "/nyfw-glitz-and-glam-runway.jpg"
  }),
  seed("seed-mv-meetup", {
    title: "Martha’s Vineyard Golf Meet-Up",
    tagline: "Connect · Learn · Swing · Thrive — a free impromptu golf meet-up",
    date: "2026-08-12", startTime: "10:00",
    location: "Farm Neck Golf Club — 1 Farm Neck Way, Oak Bluffs, MA 02557",
    extraDetails: "Free to attend · All skill levels welcome",
    description: MV_TEXT, pastNote: "Sold out · This event has taken place",
    image: "/martha-vineyard-social-meetup.jpg"
  }),
  seed("seed-mv-meetup-listing", {
    title: "Martha’s Vineyard Golf Meet-Up",
    tagline: "Connect · Learn · Swing · Thrive — a free impromptu golf meet-up",
    date: "2026-08-12", startTime: "10:00",
    location: "Farm Neck Golf Club — 1 Farm Neck Way, Oak Bluffs, MA 02557",
    extraDetails: "Free to attend · All skill levels welcome",
    description: MV_TEXT, pastNote: "Sold out · This event has taken place",
    image: "/martha-vineyard-social-meetup-listing.jpg", tallImage: false
  }),
  seed("seed-sunrise-yoga", {
    title: "Sunrise Yoga on the Beach",
    tagline: "Breathe · Stretch · Connect — a Martha's Vineyard morning of movement and mindfulness",
    date: "2026-08-13", startTime: "08:00",
    location: "Inkwell Beach — Oak Bluffs, MA",
    extraDetails: "Free to join · All experience levels welcome",
    description: "A sunrise beach yoga session to start the Martha’s Vineyard morning with movement, mindfulness, and meaningful connections.",
    image: "/sunrise-yoga-on-the-beach.jpg"
  }),
  seed("seed-ladies-love-lemonade", {
    title: "Ladies Love Lemonade",
    tagline: "Presented by Joe Golf, in conjunction with Kappa Alpha Psi Fraternity, Inc. — Baltimore Alumni Chapter",
    date: "2026-07-10", startTime: "11:00", endTime: "13:00",
    location: "Pine Ridge Golf Course — 3060 Ridge Rd, Eldersburg, MD 21784",
    extraDetails: "Complimentary · Ladies only, all skill levels",
    description:
      "A curated golf experience and clinic for ladies. An introductory session led by PGA instructors covering the basics and fundamentals of golf, putting, and chipping — with complimentary lemonade courtesy of Tito’s.",
    image: "/ladies-love-lemonade.jpg"
  })
];

// Reuse the portal event checks for date, time, location and link, then add the
// website-only fields. The photo is checked here because site photos live elsewhere.
export function validateSiteEvent(body) {
  const { event, error } = validateEvent({ ...body, image: "" });
  if (error) return { error };
  event.image = clean(body.image, 500);
  if (event.image && !LOCAL_IMAGE.test(event.image) && !httpsUrl(event.image)) {
    return { error: "The photo must be an uploaded photo or an https:// image address." };
  }
  event.tagline = clean(body.tagline, 200);
  event.extraDetails = String(body.extraDetails ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim().slice(0, 200))
    .filter(Boolean)
    .slice(0, 6)
    .join("\n");
  event.pastNote = clean(body.pastNote, 120);
  event.tallImage = body.tallImage !== false && body.tallImage !== "false";
  return { event };
}

const publicView = (e, today) => ({
  id: e.id,
  title: e.title,
  tagline: e.tagline || "",
  dateMode: modeOf(e),
  date: e.date,
  startTime: e.startTime,
  endTime: e.endTime,
  location: e.location,
  locationTbd: Boolean(e.locationTbd),
  extraDetails: e.extraDetails || "",
  description: e.description,
  link: e.link,
  linkLabel: e.linkLabel,
  pastNote: e.pastNote || "",
  image: e.image,
  tallImage: e.tallImage !== false,
  featured: Boolean(e.featured),
  isPast: isPast(e, today)
});

export function createSiteEvents(dataDir, { requireAdmin }) {
  const store = jsonStore(path.join(dataDir, "site-events.json"), { events: SEED_EVENTS });
  const uploadDir = path.join(dataDir, "..", "uploads", "site-events");
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });

  async function dropImage(url, data) {
    if (!url || !url.startsWith("/uploads/site-events/") || data.events.some((e) => e.image === url)) return;
    await fs.unlink(path.join(uploadDir, path.basename(url))).catch(() => {});
  }

  function mountRoutes(app) {
    // Public: published events, upcoming first (soonest first) then past (most recent first).
    app.get("/api/events", async (_req, res) => {
      const today = todayEastern();
      const { events } = await store.read();
      const shown = events.filter((e) => e.status === "published").sort(byDate).map((e) => publicView(e, today));
      res.set("Cache-Control", "no-cache");
      res.json({ ok: true, events: [...shown.filter((e) => !e.isPast), ...shown.filter((e) => e.isPast).reverse()] });
    });

    app.get("/api/admin/site-events", requireAdmin, async (_req, res) => {
      const today = todayEastern();
      const { events } = await store.read();
      res.json({ ok: true, today, events: events.sort(byDate).map((e) => ({ ...e, ...publicView(e, today), status: e.status })) });
    });

    app.post("/api/admin/site-events", requireAdmin, async (req, res) => {
      const { event, error } = validateSiteEvent(req.body || {});
      if (error) return res.status(400).json({ ok: false, error });
      const now = new Date().toISOString();
      const created = { id: crypto.randomUUID(), ...event, featured: false, status: "published", createdAt: now, updatedAt: now };
      await store.update((data) => {
        data.events.push(created);
      });
      res.json({ ok: true, event: created });
    });

    app.put("/api/admin/site-events/:id", requireAdmin, async (req, res) => {
      const { event, error } = validateSiteEvent(req.body || {});
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

    app.patch("/api/admin/site-events/:id/status", requireAdmin, async (req, res) => {
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

    app.patch("/api/admin/site-events/:id/featured", requireAdmin, async (req, res) => {
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

    app.delete("/api/admin/site-events/:id", requireAdmin, async (req, res) => {
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

    app.post("/api/admin/site-events/image", requireAdmin, (req, res) => {
      upload.single("image")(req, res, async (err) => {
        if (err) return res.status(400).json({ ok: false, error: "Choose one photo under 5 MB." });
        const b = req.file?.buffer;
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
          res.json({ ok: true, image: `/uploads/site-events/${name}` });
        } catch {
          res.status(500).json({ ok: false, error: "The photo could not be saved. Please try again." });
        }
      });
    });
  }

  return { mountRoutes };
}
