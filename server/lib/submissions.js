import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import multer from "multer";
import { jsonStore } from "./store.js";
import { createRateLimiter } from "./auth.js";

const extension = (b) => b.subarray(0, 3).equals(Buffer.from([255, 216, 255])) ? "jpg"
  : b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? "png"
  : b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP" ? "webp" : null;

function documentExtension(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  const b = file.buffer;
  if (ext === ".pdf" && b.toString("ascii", 0, 5) === "%PDF-") return "pdf";
  if (ext === ".doc" && b.subarray(0, 8).equals(Buffer.from([208, 207, 17, 224, 161, 177, 26, 225]))) return "doc";
  if (ext === ".docx" && b.subarray(0, 4).equals(Buffer.from([80, 75, 3, 4])) && b.includes(Buffer.from("[Content_Types].xml")) && b.includes(Buffer.from("word/document.xml"))) return "docx";
  return null;
}

export function mountSubmissions(app, dataDir, requireAdmin) {
  const store = jsonStore(path.join(dataDir, "submissions.json"), { submissions: [] });
  // Contributor images live outside the publicly served uploads directory.
  const imageDir = path.join(dataDir, "submission-images");
  const allow = createRateLimiter(8, 60 * 60 * 1000);
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 5, fields: 9, parts: 14, fieldSize: 400000 },
    fileFilter: (_req, file, done) => (file.fieldname === "document" ? /\.(pdf|docx?)$/i.test(file.originalname) : ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) ? done(null, true) : done(new Error("Invalid file type"))
  }).fields([{ name: "photos", maxCount: 3 }, { name: "portrait", maxCount: 1 }, { name: "document", maxCount: 1 }]);

  app.post("/api/submissions", (req, res) => {
    if (!allow(req.ip)) return res.status(429).json({ error: "Too many attempts. Please try again in an hour." });
    upload(req, res, async (error) => {
      if (error) return res.status(400).json({ error: "Upload up to 3 JPG, PNG, or WebP article photos plus 1 portrait (5 MB each), and 1 Word or PDF article (10 MB maximum)." });
      const fields = {};
      for (const [key, max] of Object.entries({ firstName: 80, lastName: 80, email: 254, city: 120, state: 80, title: 200 })) {
        const value = req.body?.[key];
        if (typeof value !== "string" || !value.trim() || value.trim().length > max) return res.status(400).json({ error: `Please complete ${key === "firstName" ? "first name" : key === "lastName" ? "last name" : key} (maximum ${max.toLocaleString()} characters).` });
        fields[key] = value.trim().replace(/\r\n/g, "\n");
      }
      const profession = req.body?.profession ?? "";
      if (typeof profession !== "string" || profession.length > 200) return res.status(400).json({ error: "Keep Profession, Business, or Passion to 200 characters." });
      fields.profession = profession.trim();
      const article = req.body?.article ?? "";
      if (typeof article !== "string" || article.length > 100000) return res.status(400).json({ error: "Keep article text to 100,000 characters." });
      fields.article = article.trim().replace(/\r\n/g, "\n");
      const document = req.files?.document?.[0];
      if (!fields.article && !document) return res.status(400).json({ error: "Paste your article or upload a Word or PDF file." });
      if (document && !documentExtension(document)) return res.status(400).json({ error: "Upload a valid Word (.doc or .docx) or PDF article." });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) return res.status(400).json({ error: "Enter a valid email address." });
      if (req.body.website) return res.status(400).json({ error: "Your submission could not be accepted." });
      const photos = req.files?.photos || [], portrait = req.files?.portrait || [];
      const files = [...photos, ...portrait];
      if (files.some((f) => f.size > 5 * 1024 * 1024)) return res.status(400).json({ error: "Each photo and portrait must be no larger than 5 MB." });
      if (files.some((f) => !extension(f.buffer))) return res.status(400).json({ error: "Please upload valid JPG, PNG, or WebP images." });
      const written = [];
      try {
        await fs.mkdir(imageDir, { recursive: true });
        const saveImage = async (f, ext = extension(f.buffer)) => {
          const filename = `${crypto.randomUUID()}.${ext}`;
          const target = path.join(imageDir, filename);
          await fs.writeFile(target, f.buffer, { flag: "wx" });
          written.push(target);
          return { filename, name: path.basename(f.originalname).slice(0, 200) };
        };
        const images = [];
        for (const f of photos) images.push(await saveImage(f));
        const headshot = portrait[0] ? await saveImage(portrait[0]) : null;
        const articleDocument = document ? await saveImage(document, documentExtension(document)) : null;
        const id = crypto.randomUUID();
        await store.update((data) => data.submissions.push({ id, ...fields, photos: images, portrait: headshot, document: articleDocument, status: "new", receivedAt: new Date().toISOString() }));
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
  app.delete("/api/admin/submissions/:id", requireAdmin, async (req, res) => {
    const removed = await store.update((data) => {
      const index = data.submissions.findIndex((s) => s.id === req.params.id);
      if (index < 0) return null;
      return data.submissions.splice(index, 1)[0];
    });
    if (!removed) return res.status(404).json({ error: "Submission not found." });
    const files = [...removed.photos, removed.portrait, removed.document].filter(Boolean);
    await Promise.all(files.map(async (file) => {
      try { await fs.unlink(path.join(imageDir, file.filename)); }
      catch (error) { if (error.code !== "ENOENT") console.error("Could not clean up a deleted submission image", error); }
    }));
    res.json({ ok: true });
  });
  app.get("/api/admin/submissions/:id/document", requireAdmin, async (req, res) => {
    const submission = (await store.read()).submissions.find((s) => s.id === req.params.id);
    if (!submission?.document) return res.status(404).json({ error: "Article document not found." });
    res.set("Cache-Control", "private, no-store");
    res.set("X-Content-Type-Options", "nosniff");
    res.download(path.join(imageDir, submission.document.filename), submission.document.name);
  });
  app.get("/api/admin/submissions/:id/images/:filename", requireAdmin, async (req, res) => {
    const submission = (await store.read()).submissions.find((s) => s.id === req.params.id);
    const file = submission && [...submission.photos, submission.portrait].filter(Boolean).find((f) => f.filename === req.params.filename);
    if (!file) return res.status(404).json({ error: "Image not found." });
    res.set("Cache-Control", "private, no-store");
    res.sendFile(path.join(imageDir, file.filename));
  });
}
