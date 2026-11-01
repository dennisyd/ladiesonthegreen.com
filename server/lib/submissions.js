import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import multer from "multer";
import { jsonStore } from "./store.js";
import { createRateLimiter } from "./auth.js";

const extension = (b) => b.subarray(0, 3).equals(Buffer.from([255, 216, 255])) ? "jpg"
  : b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? "png"
  : b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP" ? "webp" : null;

export function mountSubmissions(app, dataDir, requireAdmin) {
  const store = jsonStore(path.join(dataDir, "submissions.json"), { submissions: [] });
  // Contributor images live outside the publicly served uploads directory.
  const imageDir = path.join(dataDir, "submission-images");
  const allow = createRateLimiter(8, 60 * 60 * 1000);
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 6, fields: 8, parts: 14, fieldSize: 400000 },
    fileFilter: (_req, file, done) => ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype) ? done(null, true) : done(new Error("Invalid image type"))
  }).fields([{ name: "photos", maxCount: 5 }, { name: "portrait", maxCount: 1 }]);

  app.post("/api/submissions", (req, res) => {
    if (!allow(req.ip)) return res.status(429).json({ error: "Too many attempts. Please try again in an hour." });
    upload(req, res, async (error) => {
      if (error) return res.status(400).json({ error: "Upload up to 5 article photos and 1 portrait, each no larger than 5 MB." });
      const fields = {};
      for (const [key, max] of Object.entries({ firstName: 80, lastName: 80, email: 254, city: 120, state: 80, title: 200, article: 100000 })) {
        const value = req.body?.[key];
        if (typeof value !== "string" || !value.trim() || value.trim().length > max) return res.status(400).json({ error: `Please complete ${key === "firstName" ? "first name" : key === "lastName" ? "last name" : key} (maximum ${max.toLocaleString()} characters).` });
        fields[key] = value.trim().replace(/\r\n/g, "\n");
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) return res.status(400).json({ error: "Enter a valid email address." });
      if (req.body.website) return res.status(400).json({ error: "Your submission could not be accepted." });
      const photos = req.files?.photos || [], portrait = req.files?.portrait || [];
      const files = [...photos, ...portrait];
      if (files.some((f) => !extension(f.buffer))) return res.status(400).json({ error: "Please upload valid JPG, PNG, or WebP images." });
      const written = [];
      try {
        await fs.mkdir(imageDir, { recursive: true });
        const saveImage = async (f) => {
          const filename = `${crypto.randomUUID()}.${extension(f.buffer)}`;
          const target = path.join(imageDir, filename);
          await fs.writeFile(target, f.buffer, { flag: "wx" });
          written.push(target);
          return { filename, name: path.basename(f.originalname).slice(0, 200) };
        };
        const images = [];
        for (const f of photos) images.push(await saveImage(f));
        const headshot = portrait[0] ? await saveImage(portrait[0]) : null;
        const id = crypto.randomUUID();
        await store.update((data) => data.submissions.push({ id, ...fields, photos: images, portrait: headshot, status: "new", receivedAt: new Date().toISOString() }));
        res.status(201).json({ ok: true, id });
      } catch (err) {
        await Promise.all(written.map((f) => fs.unlink(f).catch(() => {})));
        console.error("Article submission could not be saved", err);
        res.status(500).json({ error: "We could not save your article. Please try again. Your form has not been cleared." });
      }
    });
  });
  app.get("/api/admin/submissions", requireAdmin, async (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.json({ submissions: (await store.read()).submissions.slice().reverse() });
  });
  app.patch("/api/admin/submissions/:id", requireAdmin, async (req, res) => {
    if (!["new", "reviewed", "selected", "declined"].includes(req.body?.status)) return res.status(400).json({ error: "Choose a valid status." });
    const found = await store.update((data) => {
      const item = data.submissions.find((s) => s.id === req.params.id);
      if (!item) return false;
      item.status = req.body.status;
      return true;
    });
    res.status(found ? 200 : 404).json(found ? { ok: true } : { error: "Submission not found." });
  });
  app.get("/api/admin/submissions/:id/images/:filename", requireAdmin, async (req, res) => {
    const submission = (await store.read()).submissions.find((s) => s.id === req.params.id);
    const file = submission && [...submission.photos, submission.portrait].filter(Boolean).find((f) => f.filename === req.params.filename);
    if (!file) return res.status(404).json({ error: "Image not found." });
    res.set("Cache-Control", "private, no-store");
    res.sendFile(path.join(imageDir, file.filename));
  });
}
