import React, { useEffect, useState } from "react";
import { navItems } from "./siteNav.js";
import WelcomeExperience from "./WelcomeExperience.jsx";
import MembershipOptions from "./MembershipOptions.jsx";
import { FOUNDING_DEADLINE_LABEL, FOUNDING_RATE_ENDS, membershipRate, regularRate } from "../../shared/membership.js";

// Prices, the founding-rate deadline and the Stripe Payment Links live in
// shared/membership.js so the server tracks payments against the same links.

const memberExperience = [
  "Members-only golf, racquet, social, wellness, and charitable experiences",
  "Exclusive member privileges, preferred offers, and partner benefits",
  "Complimentary quarterly digital access to The Collective, the Ladies on the Green® golf and lifestyle magazine",
  "Golf lessons, practice sessions, and intimate small-group instruction",
  "Opportunities to play premier courses and discover new golf destinations",
  "Curated golf travel to iconic destinations, including our signature annual golf trip",
  "Exclusive partner privileges across golf, wellness, travel, dining, fashion, and lifestyle",
  "Meaningful networking opportunities to build relationships, expand your circle, and grow your business",
  "Access to our private member community for conversations, connections, invitations, and opportunities",
  "Special member surprises and privileges throughout the year"
];

export default function JoinPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [tier, setTier] = useState(() => new URLSearchParams(window.location.search).get("tier") === "prestige" ? "prestige" : "social");
  const [pricingNow, setPricingNow] = useState(() => new Date());
  const rate = membershipRate(tier, pricingNow);
  const [formState, setFormState] = useState({ status: "idle", message: "" });

  useEffect(() => {
    const delay = FOUNDING_RATE_ENDS.getTime() - Date.now();
    if (delay <= 0) return;
    const timer = setTimeout(() => setPricingNow(new Date()), Math.min(delay, 2147483647));
    return () => clearTimeout(timer);
  }, [pricingNow]);

  function chooseTier(value) {
    if (formState.status === "loading") return;
    setTier(value);
    setFormState({ status: "idle", message: "" });
  }

  useEffect(() => {
    document.title = "Become A Member | Ladies On The Green";
    const target = window.location.hash.slice(1);
    if (["welcome", "membership-options", "signup"].includes(target)) {
      document.getElementById(target)?.scrollIntoView();
    }
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    // Recheck the date on submit in case this tab was left open overnight.
    const membershipPaymentUrl = membershipRate(payload.membershipTier).paymentUrl;

    setFormState({ status: "loading", message: "Saving your details..." });

    function goToPayment() {
      setFormState({ status: "success", message: "Thank you! Taking you to secure payment..." });
      const url = new URL(membershipPaymentUrl);
      url.searchParams.set("prefilled_email", payload.email);
      window.location.href = url.toString();
    }

    try {
      const response = await fetch("/api/membership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));

      if (response.status === 400) {
        setFormState({ status: "error", message: data.error || "Please complete all required fields." });
        return;
      }

      // The server logs every application before it tries to send email, so a
      // server-side failure should never stand between a member and payment.
      if (membershipPaymentUrl) {
        goToPayment();
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || "Something went wrong.");
      }

      form.reset();
      setFormState({ status: "success", message: data.message });
    } catch (error) {
      // Network hiccup while saving: still let the member pay.
      if (membershipPaymentUrl) {
        goToPayment();
        return;
      }
      setFormState({
        status: "error",
        message: error.message || "Please try again in a moment."
      });
    }
  }

  return (
    <>
      <header className="site-header" aria-label="Primary navigation">
        <a className="brand" href="/" aria-label="Ladies On The Green home">
          <img src="/ladiesonthegreen.png?v=2" alt="" />
        </a>
        <span aria-hidden="true" />
        <button className="menu-toggle" type="button" onClick={() => setMenuOpen((open) => !open)}>
          {menuOpen ? "Close" : "Menu"}
        </button>
        <nav className={menuOpen ? "is-open" : ""}>
          {navItems.map((item) => (
            <a href={item.href} key={item.href}>{item.label}</a>
          ))}
        </nav>
        <div className="header-actions">
          <a className="header-cta" href="/join" aria-current="page">Become A Member ↘</a>
        </div>
      </header>

      <main className="join-page">
        <WelcomeExperience />
        <MembershipOptions tier={tier} onChange={chooseTier} now={pricingNow} disabled={formState.status === "loading"} />
        <div className="join-page__grid">
          <section className="join-copy" aria-labelledby="join-title">
            <h2 id="join-title" className="join-copy__signup-title">Your next experience begins here.</h2>

            <h3>Your Member Experience</h3>
            <ul className="join-copy__list">
              {memberExperience.map((item) => <li key={item}>{item}</li>)}
              {tier === "prestige" && <>
                <li>Priority registration for select golf clinics, events, and travel experiences</li>
                <li>VIP gatherings, curated introductions, and special partner privileges</li>
                <li>A signature welcome gift, two printed magazine editions annually, and a featured member spotlight</li>
              </>}
            </ul>

            <div className="join-copy__offer">
              <span className="section-kicker">{rate.name}</span>
              <p className="join-copy__price">
                {rate.isFounding && <s className="price-was">${regularRate.amount}</s>}
                ${rate.amount} <span>/ year</span>
              </p>
              {rate.isFounding && (
                <p className="join-copy__deadline">The ${rate.amount} annual deal expires {FOUNDING_DEADLINE_LABEL}. Then ${regularRate.amount}/year.</p>
              )}
              <p>
                {tier === "prestige" ? "Enjoy an elevated level of belonging with enhanced access, VIP connections, and a more personalized Collective experience." : "Join our community for golf, friendship, wellness, travel, and experiences curated especially for LOTG members."}
              </p>
              <a className="button button--gold" href="#signup">Join {rate.name}</a>
            </div>
          </section>

          <aside className="checkout" id="signup" aria-labelledby="checkout-title">
            <div className="checkout__head">
              <div>
                <h2 id="checkout-title">{rate.name}</h2>
                <img src="/ladiesonthegreen.png?v=2" alt="Ladies On The Green" />
              </div>
              <p className="checkout__price">
                {rate.isFounding && <s className="price-was">${regularRate.amount}.00</s>}
                <span>USD</span> ${rate.amount}.00
                <small>Yearly</small>
              </p>
            </div>

            <form className="checkout__form" onSubmit={handleSubmit}>
              <fieldset>
                <legend>Your membership</legend>
                <label>
                  Membership type
                  <select name="membershipTier" value={tier} onChange={(event) => chooseTier(event.target.value)} disabled={formState.status === "loading"}>
                    <option value="social">Social Membership — ${membershipRate("social", pricingNow).amount}/year</option>
                    <option value="prestige">Founding Prestige Membership — $350/year</option>
                  </select>
                </label>
              </fieldset>
              <fieldset>
                <legend>Contact <span className="checkout__req-note">* Required</span></legend>
                <label>
                  <span>Email <b className="req" aria-hidden="true">*</b></span>
                  <input name="email" type="email" autoComplete="email" placeholder="Email" required />
                </label>
                <label>
                  <span>Full name <b className="req" aria-hidden="true">*</b></span>
                  <input name="name" type="text" autoComplete="name" placeholder="First and last name" required />
                </label>
                <label>
                  <span>Address <b className="req" aria-hidden="true">*</b></span>
                  <input name="address" type="text" autoComplete="address-line1" placeholder="Address" required />
                </label>
                <input name="address2" type="text" autoComplete="address-line2" placeholder="Apt, Suite" aria-label="Apt, Suite" />
                <div className="checkout__row">
                  <input name="city" type="text" autoComplete="address-level2" placeholder="City *" aria-label="City (required)" required />
                  <input name="zip" type="text" autoComplete="postal-code" placeholder="Zip *" aria-label="Zip (required)" required />
                </div>
                <select name="country" autoComplete="country-name" aria-label="Country" defaultValue="United States">
                  <option>United States</option>
                  <option>Canada</option>
                  <option>United Kingdom</option>
                  <option>Other</option>
                </select>
                <input name="state" type="text" autoComplete="address-level1" placeholder="State/Province/Region *" aria-label="State/Province/Region (required)" required />
                <label>
                  Phone number
                  <input name="phone" type="tel" autoComplete="tel" placeholder="Phone Number" />
                </label>
              </fieldset>

              <div className="checkout__summary">
                <h3>Summary</h3>
                <div className="checkout__line">
                  <span>Ladies on the Green {rate.name}</span>
                  <strong>
                    {rate.isFounding && <s className="price-was">${regularRate.amount}.00</s>}
                    ${rate.amount}.00<small>Yearly</small>
                  </strong>
                </div>
                <div className="checkout__due">
                  <span>Due now</span>
                  <strong><em>USD</em> ${rate.amount}.00</strong>
                </div>
              </div>

              <button className="checkout__pay" type="submit" disabled={formState.status === "loading"}>
                {formState.status === "loading" ? "Please wait..." : "Continue to secure payment"}
              </button>
              <p className={`form-status form-status--${formState.status}`} role="status">
                {formState.message}
              </p>
              <p className="checkout__secure">
                &#128274; Card details are entered on Stripe&rsquo;s secure payment page &mdash; never on this site.
              </p>
            </form>
          </aside>
        </div>
      </main>
    </>
  );
}
