import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import express from "express";
import { createMembership } from "./members.js";
import { createAuth } from "./lib/auth.js";
import { magazineMetadata, requireFinalMagazine } from "./lib/magazine-release.js";

test("magazine stays members-only and draft PDFs remain private until final approval", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lotg-magazine-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, "members.json"), JSON.stringify({ members: [
    { id: "active", status: "active" },
    { id: "canceled", status: "canceled" }
  ] }));
  const membership = createMembership(root);
  const auth = createAuth(root);
  const app = express();
  app.get("/api/magazine", membership.requireMember, magazineMetadata(async () => {
    assert.fail("Draft metadata must not be read or exposed before approval");
  }));
  app.use("/uploads/magazine", membership.requireMember, requireFinalMagazine);
  app.use("/uploads", (_req, res) => res.send("draft PDF must never be served"));
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const request = (url, member) => fetch(`http://127.0.0.1:${server.address().port}${url}`, {
    headers: member ? { cookie: `lotg_member=${auth.sign({ t: "member", mid: member }, 60)}` } : {}
  });
  for (const url of ["/api/magazine", "/uploads/magazine/draft.pdf"]) {
    assert.equal((await request(url)).status, 401);
    assert.equal((await request(url, "canceled")).status, 403);
  }
  const metadata = await request("/api/magazine", "active");
  assert.equal(metadata.status, 200);
  assert.equal(metadata.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(await metadata.json(), {
    ok: true, comingSoon: true, message: "INAUGURAL FALL ISSUE COMING SOON"
  });
  const pdf = await request("/uploads/magazine/draft.pdf", "active");
  assert.equal(pdf.status, 423);
  assert.equal(pdf.headers.get("cache-control"), "private, no-store");
  assert.equal((await pdf.json()).error, "INAUGURAL FALL ISSUE COMING SOON");
});
