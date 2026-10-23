import React from "react";
import { FOUNDING_DEADLINE_LABEL, membershipRate, regularRate } from "../../shared/membership.js";

const benefits = [
  ["Members-only golf outings, clinics, and social gatherings", "Included", "Included"],
  ["Preferred pricing on golf clinics and instruction", "Included", "Included"],
  ["Member rates at LOTG outings and play days", "Included", "Included"],
  ["Networking with women across cities and states", "Included", "VIP curated connections"],
  ["Golf getaways and travel experiences", "Member access", "Priority access"],
  ["Lifestyle and social experiences", "Included", "Priority invitations"],
  ["Girls on the Green® initiatives and community service", "Included", "Included"],
  ["Golf buddies and networking opportunities", "Included", "Included"],
  ["Digital LOTG magazine", "Included", "Included"],
  ["Special offers from golf and lifestyle partners", "Included", "Enhanced VIP perks"],
  ["Golf apparel and accessory partner discounts", "Select offers", "Exclusive offers"],
  ["Priority registration for select golf outings and clinics", "—", "Included"],
  ["Reserved spots at select LOTG events", "—", "Priority reservation opportunities"],
  ["Early access to partner-hosted events and special sales", "—", "Included"],
  ["VIP golf welcome kit with branded accessories", "—", "Included"],
  ["Annual magazine member spotlight", "—", "Included"],
  ["Exclusive Founder’s Circle gathering", "—", "Included"],
  ["Private VIP social and networking experiences", "—", "Included"]
];

export default function MembershipOptions({ tier, onChange, now, disabled }) {
  const social = membershipRate("social", now);
  const prestige = membershipRate("prestige", now);
  return (
    <section className="membership-options" id="membership-options" aria-labelledby="membership-options-title">
      <header className="section-heading">
        <span className="section-kicker">Membership at a Glance</span>
        <h2 id="membership-options-title">Two distinctive experiences. One extraordinary Collective.</h2>
        <p>Choose the membership that complements your lifestyle.</p>
      </header>
      <fieldset className="membership-options__choices" disabled={disabled}>
        <legend className="sr-only">Choose your membership</legend>
        {[social, prestige].map((rate) => (
          <label className={`membership-option${tier === rate.tier ? " is-selected" : ""}`} key={rate.tier}>
            <input type="radio" name="membership-choice" value={rate.tier} checked={tier === rate.tier} onChange={() => onChange(rate.tier)} />
            <span className="membership-option__name">{rate.name}</span>
            <span className="membership-option__price">
              {rate.isFounding && <s>${regularRate.amount}</s>} ${rate.amount}<small>/ year</small>
            </span>
            <span className="membership-option__description">
              {rate.tier === "social" ? "Golf, friendship, wellness, travel, community, and select partner offers." : "Enhanced access, VIP connections, a welcome gift, two printed magazine editions annually, and a member spotlight."}
            </span>
            {rate.isFounding && <span className="membership-option__deadline">Founding rate through {FOUNDING_DEADLINE_LABEL}. ${regularRate.amount}/year from November 1.</span>}
            <span className="membership-option__selected">{tier === rate.tier ? "Selected" : "Select membership"}</span>
          </label>
        ))}
      </fieldset>
      <a className="button button--gold" href="#signup">Continue with {membershipRate(tier, now).name} ↘</a>
      <div className="membership-comparison" role="region" aria-label="Membership benefits comparison" tabIndex={0}>
        <table>
          <caption>Compare your membership benefits</caption>
          <thead><tr><th scope="col">Membership Benefits</th><th scope="col">Social Membership</th><th scope="col">Founding Prestige Membership</th></tr></thead>
          <tbody>
            <tr><th scope="row">Annual Investment</th><td>${social.amount}{social.isFounding && <small>Through {FOUNDING_DEADLINE_LABEL}; then ${regularRate.amount}</small>}</td><td>${prestige.amount}</td></tr>
            {benefits.map(([benefit, socialValue, prestigeValue]) => <tr key={benefit}><th scope="row">{benefit}</th><td>{socialValue}</td><td>{prestigeValue}</td></tr>)}
          </tbody>
        </table>
      </div>
      <p className="membership-options__note">Annual memberships. Taxes, if applicable, are calculated at checkout. All experiences, offers, and preferred rates are subject to availability. Some events require separate registration or payment. The inaugural digital magazine is coming soon.</p>
    </section>
  );
}
