import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import express from "express";
import { createMagazineIssues } from "./lib/magazine-issues.js";

test("magazine drafts remain private and published editions stay in the archive", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lotg-magazine-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const dataDir = path.join(root, "data");
  const admin = (req, res, next) => req.get("x-admin") === "yes" ? next() : res.sendStatus(401);
  const member = (req, res, next) => req.get("x-member") === "yes" ? next() : res.sendStatus(401);
  const app = express();
  app.use(express.json());
  const magazines = createMagazineIssues(dataDir, { requireAdmin: admin, requireMember: member });
  await magazines.ready;
  magazines.mountRoutes(app);
  app.use("/uploads", express.static(path.join(root, "uploads")));
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = (url, role) => fetch(base + url, { headers: role ? { [`x-${role}`]: "yes" } : {} });
  const action = (url, role) => fetch(base + url, { method: "POST", headers: { [`x-${role}`]: "yes" } });
  const upload = (title) => {
    const form = new FormData();
    form.set("title", title);
    form.set("edition", "Winter 2027");
    form.set("file", new Blob(["%PDF-1.4\n%%EOF"], { type: "application/pdf" }), `${title}.pdf`);
    return fetch(base + "/api/admin/magazine-issues", { method: "POST", headers: { "x-admin": "yes" }, body: form });
  };

  assert.equal((await get("/api/magazine")).status, 401);
  assert.equal((await get("/api/admin/magazine-issues")).status, 401);
  assert.equal((await (await get("/api/magazine", "member")).json()).comingSoon, true);

  const first = (await (await upload("First issue")).json()).issue;
  assert.equal(first.status, "draft");
  assert.equal((await get(`/uploads/magazine/${first.filename}`, "member")).status, 404);
  assert.equal((await get(`/api/admin/magazine-issues/${first.id}/pdf`, "admin")).status, 200);
  assert.equal((await (await get("/api/magazine", "member")).json()).comingSoon, true);

  await action(`/api/admin/magazine-issues/${first.id}/publish`, "admin");
  assert.equal((await (await get("/api/magazine", "member")).json()).id, first.id);
  assert.equal((await get(`/uploads/magazine/${first.filename}`, "member")).status, 200);
  assert.equal((await get(`/uploads/magazine/${first.filename}`)).status, 401);

  const second = (await (await upload("Second issue")).json()).issue;
  await action(`/api/admin/magazine-issues/${second.id}/publish`, "admin");
  const listed = (await (await get("/api/magazine/issues", "member")).json()).issues;
  assert.equal(listed.find((issue) => issue.id === first.id).status, "archived");
  assert.equal(listed.find((issue) => issue.id === second.id).status, "published");
  assert.equal((await get(`/uploads/magazine/${first.filename}`, "member")).status, 200);
  assert.equal((await (await get("/api/magazine", "member")).json()).id, second.id);

  await action(`/api/admin/magazine-issues/${second.id}/archive`, "admin");
  assert.equal((await (await get("/api/magazine", "member")).json()).comingSoon, true);
  assert.equal((await (await get(`/api/magazine/issues/${second.id}`, "member")).json()).status, "archived");
});

test("an existing single-issue PDF is preserved as a private draft", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lotg-magazine-legacy-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const dataDir = path.join(root, "data");
  const uploadsDir = path.join(root, "uploads", "magazine");
  await fs.mkdir(dataDir, { recursive: true });
  await fs.mkdir(uploadsDir, { recursive: true });
  await fs.writeFile(path.join(uploadsDir, "old-issue.pdf"), "%PDF-1.4\n%%EOF");
  await fs.writeFile(path.join(dataDir, "magazine.json"), JSON.stringify({
    filename: "old-issue.pdf", title: "Earlier draft", originalName: "old-issue.pdf", uploadedAt: "2026-01-01T00:00:00.000Z"
  }));
  const magazines = createMagazineIssues(dataDir, {
    requireAdmin: (_req, _res, next) => next(), requireMember: (_req, _res, next) => next()
  });
  await magazines.ready;
  const data = JSON.parse(await fs.readFile(path.join(dataDir, "magazine.json"), "utf8"));
  assert.equal(data.issues.length, 1);
  assert.equal(data.issues[0].status, "draft");
  assert.equal(data.issues[0].title, "Earlier draft");
  assert.equal((await fs.readFile(path.join(uploadsDir, "old-issue.pdf"), "utf8")).startsWith("%PDF-"), true);
});
