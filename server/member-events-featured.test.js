import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import express from "express";
import { createMemberEvents } from "./lib/member-events.js";

test("admin can feature one of two same-day portal events", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lotg-member-events-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const app = express();
  app.use(express.json());
  createMemberEvents(root, {
    requireAdmin: (_req, _res, next) => next(),
    requireMember: (_req, _res, next) => next()
  }).mountRoutes(app);
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

  const first = (await request("/api/admin/events", "POST", { title: "Morning round", date: "2027-05-10", startTime: "09:00" })).data.event;
  const second = (await request("/api/admin/events", "POST", { title: "Evening round", date: "2027-05-10", startTime: "17:00" })).data.event;
  assert.equal((await request(`/api/admin/events/${second.id}/featured`, "PATCH", { featured: true })).status, 200);
  let memberEvents = (await request("/api/members/events")).data.events;
  assert.equal(memberEvents[0].id, second.id);
  assert.deepEqual(memberEvents.filter((event) => event.featured).map((event) => event.id), [second.id]);

  await request(`/api/admin/events/${first.id}/featured`, "PATCH", { featured: true });
  memberEvents = (await request("/api/members/events")).data.events;
  assert.equal(memberEvents[0].id, first.id);
  assert.deepEqual(memberEvents.filter((event) => event.featured).map((event) => event.id), [first.id]);

  await request(`/api/admin/events/${first.id}/status`, "PATCH", { status: "archived" });
  memberEvents = (await request("/api/members/events")).data.events;
  assert.equal(memberEvents.length, 1);
  assert.equal(memberEvents[0].featured, false);
  assert.equal((await request(`/api/admin/events/${first.id}/featured`, "PATCH", { featured: true })).status, 400);
});
