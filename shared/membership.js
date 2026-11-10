// Membership pricing and Stripe Payment Links, shared by the Join page (client)
// and the server (application emails, Stripe payment tracking).

// Set this to false and redeploy to restore $149/year for new Social signups.
const SOCIAL_OFFER_ACTIVE = true;
export const foundingRate = { amount: 99, paymentUrl: "https://buy.stripe.com/aFaeVd0bV3aUf5Rbpwdby0E" };
export const regularRate = { amount: 149, paymentUrl: "https://buy.stripe.com/3cI3cve2LeTC2j53X4dby0F" };
export const prestigeRate = { amount: 350, paymentUrl: "https://buy.stripe.com/3cI5kD3o7aDm4rd9hodby0G" };

export const membershipTiers = {
  social: { name: "Social Membership" },
  prestige: { name: "Founding Prestige Membership" }
};

export function membershipRate(tier = "social") {
  if (!Object.hasOwn(membershipTiers, tier)) throw new Error("Please choose a valid membership.");
  return {
    ...(tier === "prestige" ? { ...prestigeRate, isFounding: false } : currentRate()),
    tier,
    name: membershipTiers[tier].name
  };
}

export function currentRate() {
  const isFounding = SOCIAL_OFFER_ACTIVE;
  return { ...(isFounding ? foundingRate : regularRate), isFounding };
}

// Every Payment Link that sells a membership, including retired ones, so payments
// made through any of them are recognised. The Stripe account also serves other
// businesses; anything bought through a link not listed here is ignored.
export const membershipPaymentUrls = [
  foundingRate.paymentUrl,
  regularRate.paymentUrl,
  prestigeRate.paymentUrl,
  "https://buy.stripe.com/7sY8wPgaT9zie1Nalsdby0B" // original $89/year (archived)
].filter(Boolean);

// Determine the purchased tier from the payment link, never the browser's choice.
export function membershipTierForPaymentUrl(url) {
  if (!membershipPaymentUrls.includes(url)) return null;
  return url === prestigeRate.paymentUrl ? "prestige" : "social";
}

// One-off event tickets sold through Payment Links: URL -> event name.
export const eventPaymentLinks = {
  "https://buy.stripe.com/cNibJ17EndPy1f165cdby0A": "Private Club Golf Experience"
};
