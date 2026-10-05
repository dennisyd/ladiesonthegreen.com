import React, { useEffect, useState } from "react";
import { currentRate, regularRate } from "../../shared/membership.js";

// Prices, the founding-rate deadline and the Stripe Payment Links live in
// shared/membership.js so the server tracks payments against the same links.

const memberExperience = [
  "Members-only golf, racquet, social, wellness, and charitable experiences",
  "Priority and early access to clinics, events, golf trips, and limited-capacity experiences",
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

const navItems = [
  { label: "Home", href: "/" },
  { label: "About Us", href: "/#about" },
  { label: "Events", href: "/#events" },
  { label: "Membership", href: "/#membership" },
  { label: "Magazine", href: "/magazine" }
];

export default function JoinPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const rate = currentRate();
  const membershipPaymentUrl = rate.paymentUrl;
  const [formState, setFormState] = useState({ status: "idle", message: "" });

  useEffect(() => {
    document.title = "Become A Member | Ladies On The Green";
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());

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
          <img src="/ladiesonthegreen.png" alt="" />
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
        <div className="join-page__grid">
          <section className="join-copy" aria-labelledby="join-title">
            <span className="section-kicker">Ladies on the Green®</span>
            <h1 id="join-title">Membership</h1>
            <p className="join-copy__lede">
              A curated collective of accomplished women connecting through golf, lifestyle, travel, and unforgettable experiences.
            </p>
            <p>
              From local greens to iconic destinations, membership opens the door to new experiences, meaningful relationships, and a community designed for women who want to play, connect, and experience more.
            </p>

            <h2>Your Member Experience</h2>
            <p>
              Membership has its privileges. As a Ladies on the Green&reg; member, you&rsquo;ll enjoy preferred access, exclusive benefits, and curated experiences designed to help you play more, connect more, and experience more.
            </p>
            <ul className="join-copy__list">
              {memberExperience.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <h2>Play. Connect. Travel. Grow.</h2>
            <p>
              Our curated calendar of golf experiences brings women together through lessons, practice, local rounds, wellness, friendly competition, networking, travel, and experiences beyond the fairway.
            </p>

            <h2>Golf Trips</h2>
            <p>
              Take your game beyond your home course. Explore iconic destinations, play memorable courses, and experience golf through the lens of friendship, travel, and connection with Ladies on the Green&reg;.
            </p>

            <h2>Our Strength Is Our Network</h2>
            <p>
              Build your circle through authentic connections with accomplished women from diverse professions, industries, and backgrounds &mdash; beyond the boardroom, on the fairway, over dinner, on the racquet court, and while experiencing the world together.
            </p>
            <p className="join-copy__quote">
              This isn&rsquo;t just a golf membership. It&rsquo;s your invitation to connect, play, travel, and experience more.
            </p>

            <div className="join-copy__offer">
              <span className="section-kicker">Founding Membership</span>
              <p className="join-copy__price">
                {rate.isFounding && <s className="price-was">${regularRate.amount}</s>}
                ${rate.amount} <span>/ year</span>
              </p>
              {rate.isFounding && (
                <p className="join-copy__deadline">The ${rate.amount} annual deal expires October 15. Then ${regularRate.amount}/year.</p>
              )}
              <p>
                Join our inaugural membership community and enjoy priority access, preferred pricing, exclusive privileges, and experiences curated especially for LOTG members.
              </p>
              <a className="button button--gold" href="#signup">Become A Founding Member</a>
            </div>

            <p className="join-copy__closing">
              Come for the golf. Stay for the friendships. Leave inspired.&reg;
              <span>From local greens to iconic destinations, your next experience begins here.</span>
            </p>
          </section>

          <aside className="checkout" id="signup" aria-labelledby="checkout-title">
            <div className="checkout__head">
              <div>
                <h2 id="checkout-title">Founding Membership</h2>
                <img src="/ladiesonthegreen.png" alt="Ladies On The Green" />
              </div>
              <p className="checkout__price">
                {rate.isFounding && <s className="price-was">${regularRate.amount}.00</s>}
                <span>USD</span> ${rate.amount}.00
                <small>Yearly</small>
              </p>
            </div>

            <form className="checkout__form" onSubmit={handleSubmit}>
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
                  <span>Ladies on the Green Founding Membership</span>
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
