import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import express from "express";
import { createSiteEvents } from "./lib/site-events.js";

test("one upcoming site event can be featured regardless of matching dates", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lotg-site-events-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, "site-events.json"), JSON.stringify({ events: [] }));

  const app = express();
  app.use(express.json());
  createSiteEvents(root, { requireAdmin: (_req, _res, next) => next() }).mountRoutes(app);
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const request = async (url, method = "GET", body) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${url}`, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    return { status: response.status, data: await response.json() };
  };

  const first = (await request("/api/admin/site-events", "POST", { title: "Morning round", date: "2027-05-10", startTime: "09:00" })).data.event;
  const second = (await request("/api/admin/site-events", "POST", { title: "Evening round", date: "2027-05-10", startTime: "17:00" })).data.event;
  assert.equal((await request(`/api/admin/site-events/${second.id}/featured`, "PATCH", { featured: true })).status, 200);
  let publicEvents = (await request("/api/events")).data.events;
  assert.equal(publicEvents.find((event) => event.featured).id, second.id);

  await request(`/api/admin/site-events/${first.id}/featured`, "PATCH", { featured: true });
  publicEvents = (await request("/api/events")).data.events;
  assert.deepEqual(publicEvents.filter((event) => event.featured).map((event) => event.id), [first.id]);

  await request(`/api/admin/site-events/${first.id}/status`, "PATCH", { status: "archived" });
  publicEvents = (await request("/api/events")).data.events;
  assert.equal(publicEvents.length, 1);
  assert.equal(publicEvents[0].featured, false);
  assert.equal((await request(`/api/admin/site-events/${first.id}/featured`, "PATCH", { featured: true })).status, 400);
});
