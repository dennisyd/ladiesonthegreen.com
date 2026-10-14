import React, { useEffect, useState } from "react";
import { api, formatDate, formatMoney } from "./api.js";
import { EventCard, eventMode } from "./EventCard.jsx";

export default function MembersPage() {
  const [member, setMember] = useState(undefined); // undefined = checking, null = signed out

  useEffect(() => {
    document.title = "Member Portal | Ladies On The Green";
    api("/api/members/me").then((data) => setMember(data.member), () => setMember(null));
  }, []);

  async function signOut() {
    await api("/api/members/logout", { method: "POST" }).catch(() => {});
    setMember(null);
  }

  if (member === undefined) return <div className="page-loading">Loading...</div>;
  if (!member) return <MemberSignIn />;
  return <Portal member={member} onSignOut={signOut} />;
}

function MemberSignIn() {
  const expired = new URLSearchParams(window.location.search).get("signin") === "expired";
  const [email, setEmail] = useState("");
  const [state, setState] = useState({ status: "idle", message: "" });

  async function submit(event) {
    event.preventDefault();
    setState({ status: "loading", message: "" });
    try {
      const data = await api("/api/members/login", { method: "POST", body: { email } });
      setState({ status: "success", message: `${data.message} Check your inbox (and spam folder).` });
    } catch (err) {
      setState({ status: "error", message: err.message });
    }
  }

  return (
    <main className="auth-card-page">
      <form className="auth-card" onSubmit={submit}>
        <a href="/"><img src="/ladiesonthegreen.png?v=2" alt="Ladies On The Green home" /></a>
        <span className="section-kicker">Members only</span>
        <h1>Member Portal</h1>
        <p>Enter the email you used to join and we&rsquo;ll send you a secure sign-in link. No password needed.</p>
        {expired && (
          <p className="form-status form-status--error" role="alert">That sign-in link has expired or isn&rsquo;t valid. Request a new one below.</p>
        )}
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required autoFocus />
        </label>
        <button className="button button--gold" type="submit" disabled={state.status === "loading"}>
          {state.status === "loading" ? "Sending..." : "Email me a sign-in link"}
        </button>
        {state.message && (
          <p className={`form-status form-status--${state.status}`} role="status">{state.message}</p>
        )}
        <p className="auth-card__foot">Not a member yet? <a href="/join">Become a member</a></p>
      </form>
    </main>
  );
}

function Portal({ member, onSignOut }) {
  const [offers, setOffers] = useState(null);
  const [events, setEvents] = useState(null);
  const [billingError, setBillingError] = useState("");

  useEffect(() => {
    api("/api/members/offers").then((d) => setOffers(d.offers), () => setOffers([]));
    api("/api/members/events").then((d) => setEvents(d.events), () => setEvents([]));
  }, []);

  async function openBilling() {
    setBillingError("");
    try {
      const { url } = await api("/api/members/billing", { method: "POST" });
      window.location.href = url;
    } catch (err) {
      setBillingError(err.message);
    }
  }

  const perks = offers || [];
  const first = member.name.split(/\s+/)[0] || "member";

  return (
    <div className="portal">
      <header className="portal-bar">
        <a href="/" className="admin-bar__brand"><img src="/ladiesonthegreen.png?v=2" alt="Ladies On The Green home" /></a>
        <nav>
          <a href="#events">Events</a>
          <a href="#offers">Offers</a>
          <button type="button" className="admin-link" onClick={onSignOut}>Sign out</button>
        </nav>
      </header>

      <main className="portal-main">
        <section className="portal-hero">
          <div>
            <span className="section-kicker">Member Portal</span>
            <h1>Welcome back, {first}.</h1>
            <p>Your upcoming member events and exclusive offers, all in one place.</p>
          </div>
          <div className="portal-card portal-card--status">
            <span className="section-kicker">Founding Membership</span>
            {member.status === "past_due" ? (
              <p className="portal-warning">Your last payment didn&rsquo;t go through. Update your card to keep your membership.</p>
            ) : (
              <p className="portal-status-line">
                {member.plan && member.plan.amount > 0 ? `${formatMoney(member.plan.amount)} / ${member.plan.interval || "year"}` : "Active member"}
              </p>
            )}
            {member.paidThrough && (
              <p>{member.cancelAtPeriodEnd ? "Membership ends" : "Renews"} {formatDate(member.paidThrough)}</p>
            )}
            {member.hasBilling && (
              <button type="button" className="button button--gold" onClick={openBilling}>Manage billing</button>
            )}
            {billingError && <p className="form-status form-status--error">{billingError}</p>}
          </div>
        </section>

        <section id="events" className="portal-section">
          <h2>Upcoming events</h2>
          {events === null && <p>Loading...</p>}
          {events && events.length === 0 && (
            <p className="admin-empty">No upcoming events right now. We&rsquo;ll let you know as soon as the next one is announced.</p>
          )}
          <div className="event-list">
            {events?.map((event, index) => (
              <EventCard key={event.id} event={event} featured={index === 0 && eventMode(event) === "exact"} />
            ))}
          </div>
        </section>

        <section id="offers" className="portal-section">
          <h2>Member offers</h2>
          {offers === null && <p>Loading...</p>}
          {offers && perks.length === 0 && <p className="admin-empty">New member offers are on the way. Check back soon.</p>}
          <div className="portal-grid">
            {perks.map((o) => <OfferCard key={o.id} offer={o} />)}
          </div>
        </section>
      </main>
    </div>
  );
}

function OfferCard({ offer }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(offer.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked; the code is still visible to copy by hand */
    }
  }

  return (
    <article className="portal-card">
      <span className="admin-sub">
        {offer.category}
        {offer.expiresOn ? ` · until ${formatDate(offer.expiresOn + "T12:00")}` : ""}
      </span>
      <h3>{offer.title}</h3>
      {offer.description && <p>{offer.description}</p>}
      {offer.code && (
        <button type="button" className="portal-code" onClick={copy} title="Copy code">
          <code>{offer.code}</code>
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      )}
      {offer.link && (
        <a className="text-link" href={offer.link} target="_blank" rel="noopener noreferrer">
          Redeem ↗
        </a>
      )}
    </article>
  );
}
