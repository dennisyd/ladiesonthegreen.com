// Membership pricing and Stripe Payment Links, shared by the Join page (client)
// and the server (application emails, Stripe payment tracking).

// Founding Membership: $99/year through October 15, 2026 (shown against a
// crossed-out $149), then $149/year from midnight Eastern on October 16.
// Each price has its own Stripe Payment Link (recurring yearly price). If a link
// is empty, the Join form still saves the application, it just skips payment.
export const FOUNDING_RATE_ENDS = new Date("2026-10-16T00:00:00-04:00");
export const foundingRate = { amount: 99, paymentUrl: "https://buy.stripe.com/aFaeVd0bV3aUf5Rbpwdby0E" };
export const regularRate = { amount: 149, paymentUrl: "" };

// Last day of the founding rate, e.g. "October 15" (the day before the switch, Eastern).
export const FOUNDING_DEADLINE_LABEL = new Date(FOUNDING_RATE_ENDS.getTime() - 1).toLocaleDateString("en-US", {
  month: "long",
  day: "numeric",
  timeZone: "America/New_York"
});

export function currentRate(now = new Date()) {
  const isFounding = now < FOUNDING_RATE_ENDS;
  return { ...(isFounding ? foundingRate : regularRate), isFounding };
}

// Every Payment Link that sells a membership, including retired ones, so payments
// made through any of them are recognised. The Stripe account also serves other
// businesses; anything bought through a link not listed here is ignored.
export const membershipPaymentUrls = [
  foundingRate.paymentUrl,
  regularRate.paymentUrl,
  "https://buy.stripe.com/7sY8wPgaT9zie1Nalsdby0B" // original $89/year (archived)
].filter(Boolean);

// One-off event tickets sold through Payment Links: URL -> event name.
export const eventPaymentLinks = {
  "https://buy.stripe.com/cNibJ17EndPy1f165cdby0A": "Private Club Golf Experience"
};
