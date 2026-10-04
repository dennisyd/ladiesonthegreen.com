import { eventPaymentLinks, membershipPaymentUrls } from "../../shared/membership.js";
import { newMember, normalizeEmail } from "./member-model.js";

// Stripe subscription status -> member status. "incomplete" (first payment not
// finished yet) is deliberately absent: the member stays "registered".
const STATUS = {
  active: "active",
  trialing: "active",
  past_due: "past_due",
  unpaid: "past_due",
  paused: "past_due",
  canceled: "canceled",
  incomplete_expired: "canceled"
};

const iso = (unix) => (unix ? new Date(unix * 1000).toISOString() : null);
const idOf = (value) => (typeof value === "string" ? value : value?.id ?? null);

// Newer Stripe API versions moved the billing period onto subscription items and
// the subscription id on invoices under `parent`; read both shapes.
const periodEnd = (sub) => sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end ?? null;
const invoiceSubscriptionId = (invoice) =>
  idOf(invoice.subscription) ??
  idOf(invoice.parent?.subscription_details?.subscription) ??
  idOf(invoice.lines?.data?.[0]?.subscription) ??
  null;

export function createStripeSync({ stripe, members, registrations }) {
  const linkUrls = new Map(); // payment link id -> url

  async function paymentLinkUrl(id) {
    if (!id) return null;
    if (!linkUrls.has(id)) {
      const link = await stripe.paymentLinks.retrieve(id);
      linkUrls.set(id, link.url);
    }
    return linkUrls.get(id);
  }

  // Which of our products a checkout was for, or null if it isn't ours.
  async function classify(session) {
    const url = await paymentLinkUrl(idOf(session.payment_link));
    if (membershipPaymentUrls.includes(url)) return { kind: "membership" };
    if (url && eventPaymentLinks[url]) return { kind: "event", name: eventPaymentLinks[url] };
    return null;
  }

  function findMember(list, { subscriptionId, customerId, email }) {
    return (
      (subscriptionId && list.find((m) => m.stripeSubscriptionId === subscriptionId)) ||
      (customerId && list.find((m) => m.stripeCustomerId === customerId)) ||
      (email && list.find((m) => m.email === email)) ||
      null
    );
  }

  // Copy a subscription's state onto its member. Only a checkout we have already
  // recognised as a membership may create a member or match one by email; plain
  // subscription/invoice events must match a subscription or customer we know,
  // so other businesses on the same Stripe account never leak in.
  async function applySubscription(sub, { email, name, phone, payment, fromCheckout = false } = {}) {
    const customerId = idOf(sub.customer);
    const customerEmail = normalizeEmail(email || sub.customer?.email);
    return members.update((data) => {
      let member = findMember(data.members, {
        subscriptionId: sub.id,
        customerId,
        email: fromCheckout ? customerEmail : null
      });
      if (!member) {
        if (!fromCheckout || !customerEmail) return null;
        member = newMember({ email: customerEmail, name, phone, source: "stripe" });
        data.members.push(member);
      }

      const status = STATUS[sub.status];
      if (status) {
        if (status === "active" && !member.activatedAt) member.activatedAt = iso(sub.start_date) || new Date().toISOString();
        member.status = status;
      }
      member.stripeCustomerId = customerId;
      member.stripeSubscriptionId = sub.id;
      const price = sub.items?.data?.[0]?.price;
      if (price?.unit_amount != null) {
        member.plan = { amount: price.unit_amount / 100, interval: price.recurring?.interval || null };
      }
      member.paidThrough = iso(periodEnd(sub));
      member.cancelAtPeriodEnd = Boolean(sub.cancel_at_period_end);
      if (sub.status === "canceled") member.canceledAt = iso(sub.canceled_at || sub.ended_at);
      if (!member.name && name) member.name = name;
      if (!member.phone && phone) member.phone = phone;
      if (payment) {
        member.lastPaymentAt = payment.at;
        member.lastPaymentAmount = payment.amount;
      }
      member.updatedAt = new Date().toISOString();
      return { id: member.id, status: member.status };
    });
  }

  async function recordRegistration(session, eventName) {
    const items = await stripe.checkout.sessions.listLineItems(session.id, { limit: 20 });
    const quantity = items.data.reduce((sum, item) => sum + (item.quantity || 0), 0) || 1;
    const details = session.customer_details || {};
    return registrations.update((data) => {
      if (data.registrations.some((r) => r.id === session.id)) return false;
      data.registrations.push({
        id: session.id,
        event: eventName,
        name: details.name || "",
        email: normalizeEmail(details.email || session.customer_email),
        phone: details.phone || "",
        quantity,
        amount: (session.amount_total ?? 0) / 100,
        currency: session.currency || "usd",
        paidAt: iso(session.created)
      });
      return true;
    });
  }

  async function handleCheckoutSession(session) {
    if (session.status && session.status !== "complete") return "ignored";
    if (session.payment_status === "unpaid") return "ignored";
    const kind = await classify(session);
    if (!kind) return "ignored";

    if (kind.kind === "event") {
      await recordRegistration(session, kind.name);
      return "event";
    }

    const subscriptionId = idOf(session.subscription);
    if (!subscriptionId) return "ignored";
    const sub =
      typeof session.subscription === "object" ? session.subscription : await stripe.subscriptions.retrieve(subscriptionId);
    const details = session.customer_details || {};
    await applySubscription(sub, {
      email: details.email || session.customer_email,
      name: details.name,
      phone: details.phone,
      payment: { at: iso(session.created), amount: (session.amount_total ?? 0) / 100 },
      fromCheckout: true
    });
    return "membership";
  }

  async function isKnownSubscription(subscriptionId) {
    const { members: list } = await members.read();
    return list.some((m) => m.stripeSubscriptionId === subscriptionId);
  }

  // Webhook entry point. Returns what happened, for logging.
  async function handleEvent(event) {
    const object = event.data.object;
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        return handleCheckoutSession(object);

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        return (await applySubscription(object)) ? "subscription" : "ignored";

      case "invoice.paid":
      case "invoice.payment_failed": {
        const subscriptionId = invoiceSubscriptionId(object);
        if (!subscriptionId || !(await isKnownSubscription(subscriptionId))) return "ignored";
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        const payment =
          event.type === "invoice.paid"
            ? { at: iso(object.status_transitions?.paid_at || object.created), amount: (object.amount_paid ?? 0) / 100 }
            : undefined;
        await applySubscription(sub, { payment });
        return "invoice";
      }

      default:
        return "ignored";
    }
  }

  // Backfill: walk every completed checkout on our payment links. Safe to repeat.
  async function syncAll() {
    const wanted = new Set([...membershipPaymentUrls, ...Object.keys(eventPaymentLinks)]);
    const counts = { membership: 0, event: 0, ignored: 0, links: 0 };
    for await (const link of stripe.paymentLinks.list({ limit: 100 })) {
      if (!wanted.has(link.url)) continue;
      counts.links += 1;
      linkUrls.set(link.id, link.url);
      for await (const session of stripe.checkout.sessions.list({ payment_link: link.id, status: "complete", limit: 100 })) {
        counts[await handleCheckoutSession(session)] += 1;
      }
    }
    return counts;
  }

  return { handleEvent, syncAll };
}
