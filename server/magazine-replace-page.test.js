import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import express from "express";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { createMagazineIssues } from "./lib/magazine-issues.js";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

async function samplePdf(labels, size = [612, 792]) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const label of labels) doc.addPage(size).drawText(label, { x: 50, y: 700, size: 24, font });
  return Buffer.from(await doc.save());
}

test("an admin can swap one page of an issue; the page keeps its place and the old file is kept", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lotg-replace-page-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const admin = (req, res, next) => req.get("x-admin") === "yes" ? next() : res.sendStatus(401);
  const member = (req, res, next) => req.get("x-member") === "yes" ? next() : res.sendStatus(401);
  const app = express();
  const magazines = createMagazineIssues(path.join(root, "data"), { requireAdmin: admin, requireMember: member });
  await magazines.ready;
  magazines.mountRoutes(app);
  app.use("/uploads", express.static(path.join(root, "uploads")));
  const server = await new Promise((resolve) => { const l = app.listen(0, "127.0.0.1", () => resolve(l)); });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;

  const form = new FormData();
  form.set("title", "Swap test");
  form.set("file", new Blob([await samplePdf(["ONE", "TWO", "THREE"])], { type: "application/pdf" }), "issue.pdf");
  const created = await (await fetch(base + "/api/admin/magazine-issues", { method: "POST", headers: { "x-admin": "yes" }, body: form })).json();
  const id = created.issue.id;
  const originalFile = created.issue.filename;
  const replace = (page, bytes, name, headers = { "x-admin": "yes" }) => {
    const f = new FormData();
    if (page !== undefined) f.set("page", String(page));
    if (bytes) f.set("file", new Blob([bytes]), name);
    return fetch(`${base}/api/admin/magazine-issues/${id}/replace-page`, { method: "POST", headers, body: f });
  };

  assert.equal((await replace(2, PNG_1X1, "p.png", {})).status, 401, "admin only");
  assert.equal((await replace(0, PNG_1X1, "p.png")).status, 400, "page 0");
  const tooFar = await replace(9, PNG_1X1, "p.png");
  assert.equal(tooFar.status, 400);
  assert.match((await tooFar.json()).error, /3 pages/);
  assert.equal((await replace(2, Buffer.from("not a page"), "p.png")).status, 400, "wrong file type");
  assert.equal((await replace(2, undefined)).status, 400, "no file");

  // swap page 2 for a PNG
  const done = await replace(2, PNG_1X1, "new-page.png");
  assert.equal(done.status, 200);
  const result = await done.json();
  assert.equal(result.pageCount, 3);
  assert.notEqual(result.issue.filename, originalFile, "saved under a new name");
  assert.deepEqual(result.issue.previousFilenames, [originalFile]);
  await fs.access(path.join(root, "uploads", "magazine", originalFile));   // old version kept
  let doc = await PDFDocument.load(await fs.readFile(path.join(root, "uploads", "magazine", result.issue.filename)));
  assert.equal(doc.getPageCount(), 3);
  assert.deepEqual(doc.getPage(1).getSize(), { width: 612, height: 792 }, "page size unchanged");

  // swap page 3 for a one-page PDF of a different shape; it is scaled to fit
  const second = await replace(3, await samplePdf(["NEW"], [400, 400]), "new.pdf");
  assert.equal(second.status, 200);
  const secondResult = await second.json();
  assert.equal(secondResult.fit, "scaled-to-fit");
  assert.equal(secondResult.issue.pageEdits.length, 2);
  doc = await PDFDocument.load(await fs.readFile(path.join(root, "uploads", "magazine", secondResult.issue.filename)));
  assert.equal(doc.getPageCount(), 3);

  // the edit is on the issue; a garbage PDF as the "new page" is refused without changing anything
  const bad = await replace(1, Buffer.from("%PDF-1.4 garbage"), "x.pdf");
  assert.equal(bad.status, 422);
  const { issues } = await (await fetch(base + "/api/admin/magazine-issues", { headers: { "x-admin": "yes" } })).json();
  assert.equal(issues[0].filename, secondResult.issue.filename);
});
