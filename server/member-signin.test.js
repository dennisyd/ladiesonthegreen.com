import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import express from "express";
import { createMembership } from "./members.js";
import { createAuth } from "./lib/auth.js";
import { createMemberCodes } from "./lib/member-codes.js";

async function temporaryDirectory(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lotg-signin-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

async function fixture(t, sendSignInEmail) {
  const root = await temporaryDirectory(t);
  await fs.writeFile(path.join(root, "members.json"), JSON.stringify({ members: [
    { id: "active", name: "Test Member", email: "member@example.com", status: "active" },
    { id: "past-due", name: "Past Due", email: "pastdue@example.com", status: "past_due" },
    { id: "canceled", name: "Canceled", email: "canceled@example.com", status: "canceled" }
  ] }));
  const app = express();
  app.use(express.json());
  createMembership(root, { sendSignInEmail }).mountRoutes(app);
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return {
    root,
    request: (url, body, cookie) => fetch(`http://127.0.0.1:${server.address().port}${url}`, {
      method: body ? "POST" : "GET",
      redirect: "manual",
      headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined
    })
  };
}

test("codes expire, survive restart as keyed hashes, resist guessing, and can only be consumed once", async (t) => {
  const root = await temporaryDirectory(t);
  const { digest } = createAuth(root);
  let now = 1000;
  const codes = createMemberCodes(root, digest, () => now);
  const first = await codes.issue("member");
  assert.match(first.code, /^\d{6}$/);
  const stored = JSON.parse(await fs.readFile(path.join(root, "signin-codes.json"), "utf8"));
  assert.equal(stored.codes[0].hash, digest(`${first.id}:${first.code}`));
  assert.equal(stored.codes[0].code, undefined);
  const restarted = createMemberCodes(root, digest, () => now);
  assert.equal(await restarted.consume(first.id, "invalid"), null);
  const results = await Promise.all([restarted.consume(first.id, first.code), restarted.consume(first.id, first.code)]);
  assert.equal(results.filter((result) => result === "member").length, 1);
  const old = await restarted.issue("member");
  const latest = await restarted.issue("member");
  assert.equal(await restarted.consume(old.id, old.code), null);
  now += 10 * 60 * 1000;
  assert.equal(await restarted.consume(latest.id, latest.code), null);
  const locked = await restarted.issue("member");
  for (let i = 0; i < 5; i++) assert.equal(await restarted.consume(locked.id, "invalid"), null);
  assert.equal(await restarted.consume(locked.id, locked.code), null);
});

test("email code verification creates a remembered session; unknown emails go to membership", async (t) => {
  const emails = [];
  const { request, root } = await fixture(t, async (email) => { emails.push(email); });
  assert.equal((await request("/api/members/me")).status, 401);
  assert.equal((await request("/api/members/login", { email: "bad-email" })).status, 400);
  const unknown = await request("/api/members/login", { email: "new@example.com" });
  assert.deepEqual(await unknown.json(), { ok: true, redirect: "/join" });
  assert.equal(emails.length, 0);
  assert.equal((await request("/api/members/login", { email: "canceled@example.com" })).status, 403);
  const loginResponse = await request("/api/members/login", { email: " MEMBER@EXAMPLE.COM " });
  assert.equal(loginResponse.status, 200);
  assert.equal(loginResponse.headers.get("set-cookie"), null);
  const login = await loginResponse.json();
  assert.equal(emails[0].to, "member@example.com");
  const code = emails[0].text.match(/^\d{6}$/m)[0];
  assert.equal(login.code, undefined);
  assert.equal((await request("/api/members/verify-code", { challengeId: login.challengeId, code: "wrong" })).status, 400);
  const verified = await request("/api/members/verify-code", { challengeId: login.challengeId, code });
  assert.equal(verified.status, 200);
  assert.equal((await verified.json()).member.email, "member@example.com");
  const cookieHeader = verified.headers.get("set-cookie");
  assert.match(cookieHeader, /HttpOnly/);
  assert.match(cookieHeader, /SameSite=Lax/);
  assert.match(cookieHeader, /Max-Age=2592000/);
  const cookie = cookieHeader.split(";")[0];
  assert.equal((await request("/api/members/me", undefined, cookie)).status, 200);
  assert.equal(emails.length, 1);
  assert.equal((await request("/api/members/verify-code", { challengeId: login.challengeId, code })).status, 400);
  const resendResponse = await request("/api/members/login", { email: "member@example.com" });
  const resend = await resendResponse.json();
  await request("/api/members/login", { email: "member@example.com" });
  assert.equal((await request("/api/members/verify-code", { challengeId: resend.challengeId, code: emails[1].text.match(/^\d{6}$/m)[0] })).status, 400);
  const oldLink = createAuth(root).sign({ t: "signin", mid: "active" }, 60);
  const legacy = await request(`/api/members/verify?token=${oldLink}`);
  assert.equal(legacy.headers.get("location"), "/members?signin=expired");
  assert.equal(legacy.headers.get("set-cookie"), null);
  assert.equal((await request("/api/members/login", { email: "pastdue@example.com" })).status, 200);
  const loggedOut = await request("/api/members/logout", {}, cookie);
  assert.match(loggedOut.headers.get("set-cookie"), /Max-Age=0/);
});

test("email failures revoke the code, and repeated send requests are limited", async (t) => {
  const { request, root } = await fixture(t, async () => { throw new Error("mail unavailable"); });
  for (let i = 0; i < 5; i++) {
    assert.equal((await request("/api/members/login", { email: "member@example.com" })).status, 503);
  }
  assert.equal((await request("/api/members/login", { email: "member@example.com" })).status, 429);
  const stored = JSON.parse(await fs.readFile(path.join(root, "signin-codes.json"), "utf8"));
  assert.deepEqual(stored.codes, []);
});
