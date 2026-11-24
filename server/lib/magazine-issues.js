import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import multer from "multer";
import { PDFDocument, PDFName } from "pdf-lib";
import { jsonStore } from "./store.js";

const PDF_NAME = /^[A-Za-z0-9_.-]+\.pdf$/i;

// What a replacement page file really is, judged by its first bytes (not its name).
function sniffPage(buffer) {
  if (buffer.length > 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-") return "pdf";
  if (buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpg";
  return null;
}
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

  const pageUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024, files: 1 }
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

    // Swap one page of an issue for a new page (PDF, PNG or JPG), exactly as supplied: it is scaled to
    // fit the page and nothing else about it is changed, so its printed page number stays whatever it
    // carries. The page keeps its place in the document (contents links and bookmarks still work). The
    // edited PDF is saved under a new file name, which also defeats browser caching; the previous file
    // is kept on disk and listed in previousFilenames so the change can be undone.
    app.post("/api/admin/magazine-issues/:id/replace-page", requireAdmin, (req, res) => {
      pageUpload.single("file")(req, res, async (error) => {
        const fail = (status, message) => res.status(status).json({ ok: false, error: message });
        if (error) return fail(400, "Choose one PDF, PNG or JPG page under 25 MB.");
        if (!req.file) return fail(400, "Choose the new page (PDF, PNG or JPG).");
        const pageNo = Number(req.body.page);
        if (!Number.isInteger(pageNo) || pageNo < 1) return fail(400, "Enter the page number to replace.");
        const kind = sniffPage(req.file.buffer);
        if (!kind) return fail(400, "The new page must be a PDF, PNG or JPG file.");
        await ready;
        const { issues } = await store.read();
        const issue = issues.find((item) => item.id === req.params.id);
        if (!issue || !PDF_NAME.test(issue.filename)) return fail(404, "Issue not found.");
        let bytes, count, fit;
        try {
          const doc = await PDFDocument.load(await fs.readFile(path.join(uploadsDir, issue.filename)));
          count = doc.getPageCount();
          if (pageNo > count) return fail(400, `This issue has ${count} pages, so there is no page ${pageNo}.`);
          const page = doc.getPage(pageNo - 1);
          const { width, height } = page.getSize();
          let draw, iw, ih;
          if (kind === "pdf") {
            const source = await PDFDocument.load(req.file.buffer);
            const [embedded] = await doc.embedPdf(source, [0]);
            iw = embedded.width; ih = embedded.height;
            draw = (box) => page.drawPage(embedded, box);
          } else {
            const image = kind === "png" ? await doc.embedPng(req.file.buffer) : await doc.embedJpg(req.file.buffer);
            iw = image.width; ih = image.height;
            draw = (box) => page.drawImage(image, box);
          }
          // Empty the page itself (keeping the same page object, so links and bookmarks still point at it).
          page.node.delete(PDFName.of("Contents"));
          page.node.delete(PDFName.of("Annots"));
          page.node.set(PDFName.of("Resources"), doc.context.obj({}));
          const scale = Math.min(width / iw, height / ih);
          const w = iw * scale, h = ih * scale;
          fit = Math.abs(w / width - 1) < 0.01 && Math.abs(h / height - 1) < 0.01 ? "exact" : "scaled-to-fit";
          draw({ x: (width - w) / 2, y: (height - h) / 2, width: w, height: h });
          bytes = await doc.save();
        } catch (err) {
          console.error("Magazine page replace failed", err);
          return fail(422, "That PDF or image could not be read. Check the files and try again.");
        }
        const filename = `${crypto.randomUUID()}.pdf`;
        try {
          await fs.writeFile(path.join(uploadsDir, filename), bytes, { flag: "wx" });
          const updated = await store.update((data) => {
            const current = data.issues.find((item) => item.id === req.params.id);
            if (!current) return null;
            (current.previousFilenames ||= []).push(current.filename);
            current.filename = filename;
            current.sizeBytes = bytes.length;
            (current.pageEdits ||= []).push({
              page: pageNo, at: new Date().toISOString(), source: String(req.file.originalname || "").slice(0, 120), fit
            });
            return current;
          });
          if (!updated) { await fs.unlink(path.join(uploadsDir, filename)).catch(() => {}); return fail(404, "Issue not found."); }
          res.set("Cache-Control", "no-store").json({ ok: true, page: pageNo, pageCount: count, fit, issue: updated });
        } catch (err) {
          await fs.unlink(path.join(uploadsDir, filename)).catch(() => {});
          console.error("Magazine page replace could not be saved", err);
          fail(500, "The page could not be saved. Please try again.");
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
