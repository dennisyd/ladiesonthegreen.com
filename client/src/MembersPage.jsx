import React, { useEffect, useState } from "react";
import { api, formatDate } from "./api.js";
import { EventCard, EventDetails, eventMode } from "./EventCard.jsx";

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
  if (!member) return <MemberSignIn onSignedIn={setMember} />;
  return <Portal member={member} onSignOut={signOut} />;
}

function MemberSignIn({ onSignedIn }) {
  const expired = new URLSearchParams(window.location.search).get("signin") === "expired";
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState(null);
  const [state, setState] = useState({ status: "idle", message: "" });

  async function sendCode() {
    setState({ status: "loading", message: "" });
    try {
      const data = await api("/api/members/login", { method: "POST", body: { email } });
      if (data.redirect === "/join") {
        window.location.assign("/join");
        return;
      }
      setChallengeId(data.challengeId);
      setCode("");
      setState({ status: "success", message: `${data.message} Check your inbox (and spam folder).` });
    } catch (err) {
      setState({ status: "error", message: err.message });
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (!challengeId) return sendCode();
    setState({ status: "loading", message: "" });
    try {
      const data = await api("/api/members/verify-code", { method: "POST", body: { challengeId, code } });
      onSignedIn(data.member);
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
        <p>{challengeId ? `Enter the six-digit code sent to ${email}. You can check your email on any device.` : "Enter the email you used to join and we’ll send you a one-time sign-in code. No password needed."}</p>
        {expired && !challengeId && (
          <p className="form-status form-status--error" role="alert">Please request a one-time code below to sign in.</p>
        )}
        {challengeId ? (
          <label key="code">
            One-time code
            <input type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} required autoFocus />
          </label>
        ) : (
          <label key="email">
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required autoFocus />
          </label>
        )}
        <button className="button button--gold" type="submit" disabled={state.status === "loading"}>
          {state.status === "loading" ? (challengeId ? "Checking..." : "Sending...") : (challengeId ? "Verify Code & Sign In" : "Email Me a Code")}
        </button>
        {challengeId && (
          <div className="admin-actions">
            <button className="admin-link" type="button" onClick={sendCode} disabled={state.status === "loading"}>Send a new code</button>
            <button className="admin-link" type="button" disabled={state.status === "loading"} onClick={() => {
              setChallengeId(null);
              setCode("");
              setState({ status: "idle", message: "" });
            }}>Use a different email</button>
          </div>
        )}
        <p>We&rsquo;ll keep you signed in on this browser for 30 days. Sign out when using a shared computer.</p>
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
  const [openEvent, setOpenEvent] = useState(null);
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
  const featuredEvent = events?.find((event) => event.featured);
  const spotlightEvent = featuredEvent || (events?.[0] && eventMode(events[0]) === "exact" ? events[0] : null);
  const otherEvents = spotlightEvent ? events.filter((event) => event.id !== spotlightEvent.id) : events;

  return (
    <div className="portal">
      <header className="portal-bar">
        <a href="/" className="admin-bar__brand"><img src="/ladiesonthegreen.png?v=2" alt="Ladies On The Green home" /></a>
        <nav>
          <a href="#events">Events</a>
          {perks.length > 0 && <a href="#offers">Offers</a>}
          {member.hasBilling && <button type="button" className="admin-link" onClick={openBilling}>Manage billing</button>}
          <button type="button" className="admin-link" onClick={onSignOut}>Sign out</button>
        </nav>
      </header>

      <main className="portal-main">
        <section className="portal-hero">
          <div>
            <span className="section-kicker">Member Portal</span>
            <h1>Welcome back, {first}.</h1>
            <p>{member.membershipTier === "prestige" ? "Founding Prestige Membership" : "Social Membership"}</p>
            <p>{perks.length > 0 ? "Your upcoming member events and exclusive offers, all in one place." : "Your upcoming member events, all in one place."}</p>
          </div>
        </section>

        {member.status === "past_due" && (
          <div className="portal-alert" role="alert">
            <p>Your last payment didn&rsquo;t go through. Please update your card to keep your membership.</p>
            {member.hasBilling ? (
              <button type="button" className="button button--gold" onClick={openBilling}>Update my card</button>
            ) : (
              <a className="button button--gold" href="mailto:hello@ladiesonthegreen.com">Contact us</a>
            )}
          </div>
        )}
        {billingError && <p className="form-status form-status--error" role="alert">{billingError}</p>}

        <section id="events" className="portal-section">
          <h2>Upcoming events</h2>
          {events === null && <p>Loading...</p>}
          {events && events.length === 0 && (
            <p className="admin-empty">No upcoming events right now. We&rsquo;ll let you know as soon as the next one is announced.</p>
          )}
          <div className="event-list">
            {spotlightEvent && (
              <div className="event-list__spotlight">
                <EventCard event={spotlightEvent} featured onOpen={setOpenEvent} />
              </div>
            )}
            {otherEvents?.map((event) => <EventCard key={event.id} event={event} onOpen={setOpenEvent} />)}
          </div>
        </section>

        {perks.length > 0 && (
          <section id="offers" className="portal-section">
            <h2>Member offers</h2>
            <div className="portal-grid">
              {perks.map((o) => <OfferCard key={o.id} offer={o} />)}
            </div>
          </section>
        )}
      </main>

      {openEvent && <EventDetails event={openEvent} onClose={() => setOpenEvent(null)} />}
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
