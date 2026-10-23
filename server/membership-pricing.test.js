import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { membershipRate, regularRate, prestigeRate, foundingRate, membershipTierForPaymentUrl } from "../shared/membership.js";
import { createMembership } from "./members.js";
import { createStripeSync } from "./lib/stripe-sync.js";
import { jsonStore } from "./lib/store.js";

async function temporaryDirectory(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lotg-pricing-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

test("Social switches price and payment link at midnight Eastern November 1; Prestige remains $350", () => {
  const before = new Date("2026-11-01T03:59:59.999Z");
  const after = new Date("2026-11-01T04:00:00.000Z");
  assert.equal(membershipRate("social", before).amount, 99);
  assert.equal(membershipRate("social", before).paymentUrl, foundingRate.paymentUrl);
  assert.equal(membershipRate("social", after).amount, 149);
  assert.equal(membershipRate("social", after).paymentUrl, "https://buy.stripe.com/3cI3cve2LeTC2j53X4dby0F");
  assert.equal(membershipRate("social", after).isFounding, false);
  for (const date of [before, after, new Date("2027-01-01")]) {
    const rate = membershipRate("prestige", date);
    assert.equal(rate.amount, 350);
    assert.equal(rate.paymentUrl, "https://buy.stripe.com/3cI5kD3o7aDm4rd9hodby0G");
    assert.equal(rate.isFounding, false);
  }
  assert.throws(() => membershipRate("other"));
  assert.throws(() => membershipRate("constructor"));
  assert.equal(membershipTierForPaymentUrl("https://example.com/another-product"), null);
});

test("applications retain the selected tier and price without creating a member", async (t) => {
  const root = await temporaryDirectory(t);
  const membership = createMembership(root);
  await membership.recordApplication({ email: "member@example.com", name: "Member", membershipTier: "prestige" });
  let data = JSON.parse(await fs.readFile(path.join(root, "signups.json"), "utf8"));
  assert.equal(data.signups[0].membershipTier, "prestige");
  assert.equal(data.signups[0].rateAtSignup, 350);
  await membership.recordApplication({ email: "member@example.com", membershipTier: "social" });
  data = JSON.parse(await fs.readFile(path.join(root, "signups.json"), "utf8"));
  assert.equal(data.signups.length, 1);
  assert.equal(data.signups[0].membershipTier, "social");
  assert.equal(data.signups[0].rateAtSignup, membershipRate("social").amount);
  await assert.rejects(membership.recordApplication({ email: "member@example.com", membershipTier: "invalid" }));
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(root, "members.json"), "utf8")).members, []);
});

test("Stripe recognizes both new links, assigns the purchased tier, and preserves it on renewal", async (t) => {
  const root = await temporaryDirectory(t);
  const members = jsonStore(path.join(root, "members.json"), { members: [] });
  const signups = jsonStore(path.join(root, "signups.json"), { signups: [] });
  const registrations = jsonStore(path.join(root, "registrations.json"), { registrations: [] });
  await signups.update((data) => data.signups.push({ id: "pending", email: "social@example.com", membershipTier: "prestige", name: "Contact Name" }));
  const links = { social: regularRate.paymentUrl, prestige: prestigeRate.paymentUrl, founding: foundingRate.paymentUrl, unrelated: "https://buy.stripe.com/unrelated" };
  const subscriptions = {};
  const stripe = {
    paymentLinks: { retrieve: async (id) => ({ url: links[id] }) },
    subscriptions: { retrieve: async (id) => subscriptions[id] }
  };
  const sync = createStripeSync({ stripe, members, signups, registrations });
  async function checkout(link, amount, paymentStatus = "paid") {
    const sub = {
      id: `sub_${link}`, customer: `cus_${link}`, status: "active", start_date: 1792713600,
      items: { data: [{ price: { unit_amount: amount * 100, recurring: { interval: "year" } }, current_period_end: 1824249600 }] }
    };
    subscriptions[sub.id] = sub;
    return sync.handleEvent({ type: "checkout.session.completed", data: { object: {
      id: `cs_${link}`, status: "complete", payment_status: paymentStatus, payment_link: link, subscription: sub,
      customer_details: { email: `${link}@example.com` }, amount_total: amount * 100, created: 1792713600
    } } });
  }
  assert.equal(await checkout("social", 149), "membership");
  assert.equal(await checkout("prestige", 350), "membership");
  assert.equal(await checkout("founding", 99), "membership");
  assert.equal(await checkout("unrelated", 350), "ignored");
  let list = (await members.read()).members;
  assert.equal(list.length, 3);
  const social = list.find((m) => m.email === "social@example.com");
  assert.equal(social.membershipTier, "social");
  assert.equal(social.name, "Contact Name");
  assert.equal(social.plan.amount, 149);
  assert.equal((await signups.read()).signups.length, 0);
  const prestige = list.find((m) => m.email === "prestige@example.com");
  assert.equal(prestige.membershipTier, "prestige");
  assert.equal(prestige.plan.amount, 350);
  assert.equal(await sync.handleEvent({ type: "invoice.paid", data: { object: {
    subscription: "sub_prestige", amount_paid: 35000, created: 1792713600
  } } }), "invoice");
  list = (await members.read()).members;
  assert.equal(list.find((m) => m.email === "prestige@example.com").membershipTier, "prestige");
  assert.equal(await checkout("prestige", 350, "unpaid"), "ignored");
});
