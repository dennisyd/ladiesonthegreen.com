import React, { useEffect, useState } from "react";
import { api, formatDate, formatMoney } from "./api.js";

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
  return <Portal member={member} onMemberChange={setMember} onSignOut={signOut} />;
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
        <a href="/"><img src="/ladiesonthegreen.png" alt="Ladies On The Green home" /></a>
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

function Portal({ member, onMemberChange, onSignOut }) {
  const [offers, setOffers] = useState(null);
  const [billingError, setBillingError] = useState("");

  useEffect(() => {
    api("/api/members/offers").then((d) => setOffers(d.offers), () => setOffers([]));
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

  const events = (offers || []).filter((o) => o.category === "Event");
  const perks = (offers || []).filter((o) => o.category !== "Event");
  const first = member.name.split(/\s+/)[0] || "member";

  return (
    <div className="portal">
      <header className="portal-bar">
        <a href="/" className="admin-bar__brand"><img src="/ladiesonthegreen.png" alt="Ladies On The Green home" /></a>
        <nav>
          <a href="#offers">Offers</a>
          <a href="#events">Events</a>
          <a href="#directory">Directory</a>
          <button type="button" className="admin-link" onClick={onSignOut}>Sign out</button>
        </nav>
      </header>

      <main className="portal-main">
        <section className="portal-hero">
          <div>
            <span className="section-kicker">Member Portal</span>
            <h1>Welcome back, {first}.</h1>
            <p>Your offers, member events, and the women of Ladies On The Green, all in one place.</p>
          </div>
          <div className="portal-card portal-card--status">
            <span className="section-kicker">Founding Membership</span>
            {member.status === "past_due" ? (
              <p className="portal-warning">Your last payment didn&rsquo;t go through. Update your card to keep your membership.</p>
            ) : (
              <p className="portal-status-line">
                {member.plan ? `${formatMoney(member.plan.amount)} / ${member.plan.interval || "year"}` : "Active member"}
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

        <section id="offers" className="portal-section">
          <h2>Member offers</h2>
          {offers === null && <p>Loading...</p>}
          {offers && perks.length === 0 && <p className="admin-empty">New member offers are on the way. Check back soon.</p>}
          <div className="portal-grid">
            {perks.map((o) => <OfferCard key={o.id} offer={o} />)}
          </div>
        </section>

        <section id="events" className="portal-section">
          <h2>Member events</h2>
          {offers && events.length === 0 && <p className="admin-empty">No member events scheduled yet. We&rsquo;ll email you when one opens.</p>}
          <div className="portal-grid">
            {events.map((o) => <OfferCard key={o.id} offer={o} />)}
          </div>
        </section>

        <Directory member={member} onMemberChange={onMemberChange} />
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
        {offer.eventDate ? ` · ${formatDate(offer.eventDate + "T12:00")}` : ""}
        {offer.expiresOn && offer.category !== "Event" ? ` · until ${formatDate(offer.expiresOn + "T12:00")}` : ""}
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
          {offer.category === "Event" ? "Details & RSVP ↗" : "Redeem ↗"}
        </a>
      )}
    </article>
  );
}

function Directory({ member, onMemberChange }) {
  const [people, setPeople] = useState(null);
  const [form, setForm] = useState(member.directory);
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState({ status: "idle", message: "" });

  const load = () => api("/api/members/directory").then((d) => setPeople(d.members), () => setPeople([]));
  useEffect(() => { load(); }, []);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  async function save(event) {
    event.preventDefault();
    try {
      const { directory } = await api("/api/members/me/directory", { method: "PUT", body: form });
      onMemberChange({ ...member, directory });
      setNote({ status: "success", message: directory.optIn ? "Your listing is live." : "Saved. You're not listed in the directory." });
      setEditing(false);
      load();
    } catch (err) {
      setNote({ status: "error", message: err.message });
    }
  }

  return (
    <section id="directory" className="portal-section">
      <div className="admin-section-head">
        <div>
          <h2>Member directory</h2>
          <p>Connect with members who have chosen to share their details. Only members can see this.</p>
        </div>
        <button type="button" className="button button--outline" onClick={() => setEditing(!editing)}>
          {editing ? "Close" : member.directory?.optIn ? "Edit my listing" : "Add me to the directory"}
        </button>
      </div>

      {editing && (
        <form className="admin-card portal-listing-form" onSubmit={save}>
          <label className="admin-check"><input type="checkbox" checked={form.optIn} onChange={set("optIn")} /> List me in the member directory</label>
          <div className="admin-row">
            <label>Title or profession<input value={form.headline} onChange={set("headline")} maxLength={120} placeholder="Attorney, Realtor, Founder..." /></label>
            <label>Company<input value={form.company} onChange={set("company")} maxLength={120} /></label>
          </div>
          <div className="admin-row">
            <label>Location<input value={form.location} onChange={set("location")} maxLength={120} placeholder="Bowie, MD" /></label>
            <label>LinkedIn<input value={form.linkedin} onChange={set("linkedin")} placeholder="https://linkedin.com/in/..." /></label>
          </div>
          <label className="admin-check"><input type="checkbox" checked={form.showEmail} onChange={set("showEmail")} /> Show my email to other members</label>
          <button className="button button--gold" type="submit">Save</button>
        </form>
      )}
      {note.message && <p className={`form-status form-status--${note.status}`} role="status">{note.message}</p>}

      {people === null && <p>Loading...</p>}
      {people && people.length === 0 && <p className="admin-empty">No one is listed yet. Be the first!</p>}
      <div className="portal-grid portal-grid--people">
        {people?.map((p) => (
          <article key={p.id} className="portal-card portal-person">
            <h3>{p.name}</h3>
            {(p.headline || p.company) && <p>{[p.headline, p.company].filter(Boolean).join(" · ")}</p>}
            {p.location && <span className="admin-sub">{p.location}</span>}
            <div className="portal-person__links">
              {p.linkedin && <a href={p.linkedin} target="_blank" rel="noopener noreferrer">LinkedIn ↗</a>}
              {p.email && <a href={`mailto:${p.email}`}>{p.email}</a>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
