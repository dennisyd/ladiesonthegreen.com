import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import multer from "multer";
import { jsonStore } from "./store.js";

const PDF_NAME = /^[A-Za-z0-9_.-]+\.pdf$/i;
const COMING_SOON = "The next issue is coming soon.";

const memberIssue = (issue) => ({
  id: issue.id,
  title: issue.title,
  edition: issue.edition || "",
  uploadedAt: issue.uploadedAt,
  publishedAt: issue.publishedAt || null,
  archivedAt: issue.archivedAt || null,
  status: issue.status,
  url: `/uploads/magazine/${encodeURIComponent(issue.filename)}`
});

export function createMagazineIssues(dataDir, { requireAdmin, requireMember }) {
  const uploadsDir = path.join(dataDir, "..", "uploads", "magazine");
  const store = jsonStore(path.join(dataDir, "magazine.json"), { issues: [] });
  const ready = Promise.all([
    fs.mkdir(uploadsDir, { recursive: true }),
    store.update((data) => {
      // The old magazine.json held one unreleased PDF. Keep it as a draft.
      if (Array.isArray(data.issues)) return;
      data.issues = PDF_NAME.test(data.filename || "") ? [{
        id: crypto.randomUUID(),
        filename: data.filename,
        originalName: data.originalName || data.filename,
        title: data.title || "The Collective Magazine",
        edition: "",
        sizeBytes: data.sizeBytes || 0,
        uploadedAt: data.uploadedAt || new Date().toISOString(),
        status: "draft"
      }] : [];
    })
  ]);

  const upload = multer({
    storage: multer.diskStorage({
      destination: uploadsDir,
      filename(_req, _file, done) { done(null, `${crypto.randomUUID()}.pdf`); }
    }),
    limits: { fileSize: 80 * 1024 * 1024, files: 1 },
    fileFilter(_req, file, done) {
      done(null, file.originalname.toLowerCase().endsWith(".pdf"));
    }
  });

  function mountRoutes(app) {
    app.get("/api/magazine", requireMember, async (_req, res) => {
      await ready;
      const { issues } = await store.read();
      const current = issues.find((issue) => issue.status === "published");
      res.set("Cache-Control", "private, no-store");
      res.json(current ? { ok: true, ...memberIssue(current) } : { ok: true, comingSoon: true, message: COMING_SOON });
    });

    app.get("/api/magazine/issues", requireMember, async (_req, res) => {
      await ready;
      const { issues } = await store.read();
      res.set("Cache-Control", "private, no-store");
      res.json({ ok: true, issues: issues
        .filter((issue) => issue.status === "published" || issue.status === "archived")
        .sort((a, b) => (b.publishedAt || b.uploadedAt).localeCompare(a.publishedAt || a.uploadedAt))
        .map(memberIssue) });
    });

    app.get("/api/magazine/issues/:id", requireMember, async (req, res) => {
      await ready;
      const { issues } = await store.read();
      const issue = issues.find((item) => item.id === req.params.id && item.status !== "draft");
      res.set("Cache-Control", "private, no-store");
      if (!issue) return res.status(404).json({ ok: false, error: "Issue not found." });
      res.json({ ok: true, ...memberIssue(issue) });
    });

    app.get("/api/admin/magazine-issues", requireAdmin, async (_req, res) => {
      await ready;
      const { issues } = await store.read();
      res.set("Cache-Control", "private, no-store");
      res.json({ ok: true, issues: issues.slice().reverse().map((issue) => ({
        ...issue,
        previewUrl: `/api/admin/magazine-issues/${issue.id}/pdf`
      })) });
    });

    app.get("/api/admin/magazine-issues/:id/pdf", requireAdmin, async (req, res) => {
      await ready;
      const { issues } = await store.read();
      const issue = issues.find((item) => item.id === req.params.id);
      if (!issue || !PDF_NAME.test(issue.filename)) return res.status(404).json({ ok: false, error: "Issue not found." });
      res.type("pdf").sendFile(path.join(uploadsDir, issue.filename), {
        cacheControl: false,
        headers: { "Cache-Control": "private, no-store" }
      });
    });

    app.post("/api/admin/magazine-issues", requireAdmin, (req, res) => {
      upload.single("file")(req, res, async (error) => {
        if (error) return res.status(400).json({ ok: false, error: "Choose one PDF under 80 MB." });
        if (!req.file) return res.status(400).json({ ok: false, error: "Choose a PDF file." });
        try {
          const handle = await fs.open(req.file.path, "r");
          let header;
          try {
            const bytes = Buffer.alloc(5);
            await handle.read(bytes, 0, 5, 0);
            header = bytes.toString("ascii");
          } finally { await handle.close(); }
          if (header !== "%PDF-") {
            await fs.unlink(req.file.path);
            return res.status(400).json({ ok: false, error: "This file is not a PDF." });
          }
          const title = String(req.body.title || "").trim().slice(0, 120);
          const edition = String(req.body.edition || "").trim().slice(0, 80);
          if (!title) {
            await fs.unlink(req.file.path);
            return res.status(400).json({ ok: false, error: "Add an issue title." });
          }
          const issue = {
            id: crypto.randomUUID(), filename: req.file.filename,
            originalName: req.file.originalname.slice(0, 255), title, edition,
            sizeBytes: req.file.size, uploadedAt: new Date().toISOString(), status: "draft"
          };
          await ready;
          await store.update((data) => { data.issues.push(issue); });
          res.status(201).json({ ok: true, issue });
        } catch (err) {
          await fs.unlink(req.file.path).catch(() => {});
          console.error("Magazine upload failed", err);
          res.status(500).json({ ok: false, error: "The issue could not be saved. Please try again." });
        }
      });
    });

    app.post("/api/admin/magazine-issues/:id/publish", requireAdmin, async (req, res) => {
      await ready;
      const result = await store.update((data) => {
        const issue = data.issues.find((item) => item.id === req.params.id);
        if (!issue) return null;
        if (issue.status === "published") return issue;
        const now = new Date().toISOString();
        for (const item of data.issues) {
          if (item.status === "published") {
            item.status = "archived";
            item.archivedAt = now;
          }
        }
        issue.status = "published";
        issue.publishedAt ||= now;
        issue.archivedAt = null;
        return issue;
      });
      if (!result) return res.status(404).json({ ok: false, error: "Issue not found." });
      res.set("Cache-Control", "no-store").json({ ok: true, issue: result });
    });

    app.post("/api/admin/magazine-issues/:id/archive", requireAdmin, async (req, res) => {
      await ready;
      const result = await store.update((data) => {
        const issue = data.issues.find((item) => item.id === req.params.id);
        if (!issue) return { error: "Issue not found.", status: 404 };
        if (issue.status === "draft") return { error: "Publish the draft before archiving it.", status: 400 };
        issue.status = "archived";
        issue.archivedAt ||= new Date().toISOString();
        return { issue };
      });
      if (result.error) return res.status(result.status).json({ ok: false, error: result.error });
      res.set("Cache-Control", "no-store").json({ ok: true, issue: result.issue });
    });

    // Only signed-in members can fetch published or archived PDFs. Drafts use
    // the separate admin preview endpoint until the owner publishes them.
    app.use("/uploads/magazine", requireMember, async (req, res, next) => {
      await ready;
      const filename = req.path.replace(/^\//, "");
      if (!PDF_NAME.test(filename)) return res.sendStatus(404);
      const { issues } = await store.read();
      if (!issues.some((issue) => issue.filename === filename && issue.status !== "draft")) return res.sendStatus(404);
      res.set("Cache-Control", "private, no-store");
      next();
    });
  }

  return { ready, mountRoutes };
}
