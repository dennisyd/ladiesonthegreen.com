import crypto from "node:crypto";

// Member status: active | past_due | canceled. A record with status "registered"
// is an unfinished Join-form sign-up; those live in signups.json, not the member list.
export function newMember(fields, nowIso = new Date().toISOString()) {
  return {
    id: crypto.randomUUID(),
    email: normalizeEmail(fields.email),
    name: fields.name || "",
    phone: fields.phone || "",
    address: fields.address || "",
    address2: fields.address2 || "",
    city: fields.city || "",
    state: fields.state || "",
    zip: fields.zip || "",
    country: fields.country || "",
    status: "registered",
    source: fields.source || "join-form",
    registeredAt: nowIso,
    rateAtSignup: fields.rateAtSignup ?? null,
    activatedAt: null,
    paidThrough: null,
    plan: null,
    cancelAtPeriodEnd: false,
    canceledAt: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    lastPaymentAt: null,
    lastPaymentAmount: null,
    reminders: { count: 0, lastAt: null },
    notes: "",
    directory: { optIn: false, headline: "", company: "", location: "", linkedin: "", showEmail: false },
    lastLoginAt: null,
    updatedAt: nowIso
  };
}

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

// Members who may sign into the portal. Past-due members can still get in so
// they can fix their card through "Manage billing".
export const canUsePortal = (member) => member && (member.status === "active" || member.status === "past_due");

// What a member sees about themselves.
export function portalView(member) {
  return {
    name: member.name,
    email: member.email,
    status: member.status,
    plan: member.plan,
    paidThrough: member.paidThrough,
    cancelAtPeriodEnd: member.cancelAtPeriodEnd,
    activatedAt: member.activatedAt,
    hasBilling: Boolean(member.stripeCustomerId),
    directory: member.directory
  };
}

// What other members see in the directory: only what the member opted to share.
export function directoryView(member) {
  const d = member.directory || {};
  return {
    id: member.id,
    name: member.name,
    headline: d.headline || "",
    company: d.company || "",
    location: d.location || [member.city, member.state].filter(Boolean).join(", "),
    linkedin: d.linkedin || "",
    email: d.showEmail ? member.email : ""
  };
}
