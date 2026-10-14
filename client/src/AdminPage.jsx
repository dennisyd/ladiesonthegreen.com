import React, { useCallback, useEffect, useMemo, useState } from "react";
import { currentRate } from "../../shared/membership.js";
import { api, formatDate, formatMoney, statusLabels } from "./api.js";

import { EventCard, eventBadge, eventMode, formatEventTime, formatEventWhen } from "./EventCard.jsx";
import ShopCatalogAdmin from "./ShopCatalogAdmin.jsx";

const tabs = ["Members", "Follow-ups", "Portal events", "Event tickets", "Shop", "Offers", "Announcements", "Settings"];

export default function AdminPage() {
  const [signedIn, setSignedIn] = useState(null); // null = checking
  const [tab, setTab] = useState(new URLSearchParams(window.location.search).get("tab") === "shop" ? "Shop" : "Members");

  useEffect(() => {
    document.title = "Admin | Ladies On The Green";
    api("/api/admin/session").then(() => setSignedIn(true), () => setSignedIn(false));
  }, []);

  async function signOut() {
    await api("/api/admin/logout", { method: "POST" }).catch(() => {});
    setSignedIn(false);
  }

  if (signedIn === null) return <div className="page-loading">Loading...</div>;
  if (!signedIn) return <AdminLogin onSignedIn={() => setSignedIn(true)} />;

  return (
    <div className="admin">
      <header className="admin-bar">
        <a href="/" className="admin-bar__brand">
          <img src="/ladiesonthegreen.png?v=2" alt="" />
          <span>Admin</span>
        </a>
        <nav className="admin-tabs" aria-label="Admin sections">
          {tabs.map((name) => (
            <button key={name} type="button" className={tab === name ? "is-active" : ""} onClick={() => setTab(name)}>
              {name}
            </button>
          ))}
        </nav>
        <button type="button" className="admin-link" onClick={signOut}>Sign out</button>
      </header>
      <main className="admin-main">
        {tab === "Members" && <MembersTab />}
        {tab === "Follow-ups" && <FollowUpsTab />}
        {tab === "Portal events" && <PortalEventsTab />}
        {tab === "Event tickets" && <EventsTab />}
        {tab === "Shop" && <ShopTab />}
        {tab === "Offers" && <OffersTab />}
        {tab === "Announcements" && <AnnouncementsTab />}
        {tab === "Settings" && <SettingsTab />}
      </main>
    </div>
  );
}

function AdminLogin({ onSignedIn }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/admin/login", { method: "POST", body: { password } });
      onSignedIn();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-card-page">
      <form className="auth-card" onSubmit={submit}>
        <img src="/ladiesonthegreen.png?v=2" alt="Ladies On The Green" />
        <h1>Admin</h1>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus required />
        </label>
        <button className="button button--gold" type="submit" disabled={busy}>{busy ? "Signing in..." : "Sign in"}</button>
        {error && <p className="form-status form-status--error" role="alert">{error}</p>}
      </form>
    </main>
  );
}

// Loads `path` and exposes { data, error, reload }.
function useApi(path) {
  const [state, setState] = useState({ data: null, error: "" });
  const reload = useCallback(() => {
    api(path).then((data) => setState({ data, error: "" }), (err) => setState((s) => ({ ...s, error: err.message })));
  }, [path]);
  useEffect(reload, [reload]);
  return { ...state, reload };
}

function StatusBadge({ status }) {
  return <span className={`status-badge status-badge--${status}`}>{statusLabels[status] || status}</span>;
}

function Notice({ error, message }) {
  if (error) return <p className="form-status form-status--error" role="alert">{error}</p>;
  if (message) return <p className="form-status form-status--success" role="status">{message}</p>;
  return null;
}

// ---------------------------------------------------------------- Members

function MembersTab() {
  const { data, error, reload } = useApi("/api/admin/members");
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState(null);
  const [emailId, setEmailId] = useState(null);
  const [adding, setAdding] = useState(false);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.members || []).filter(
      (m) =>
        (filter === "all" || m.status === filter) &&
        (!q || `${m.name} ${m.email} ${m.city} ${m.state}`.toLowerCase().includes(q))
    );
  }, [data, filter, query]);

  if (!data) return <Notice error={error} message={error ? "" : "Loading members..."} />;
  const { stats } = data;
  const filters = [
    ["all", `All (${stats.total})`],
    ["active", `Active (${stats.active})`],
    ["past_due", `Past due (${stats.pastDue})`],
    ["canceled", `Canceled (${stats.canceled})`]
  ];

  return (
    <section>
      <div className="admin-stats">
        <Stat label="Active members" value={stats.active} />
        <Stat label="Started, not paid (see Follow-ups)" value={stats.unpaidSignups} />
        <Stat label="Past due" value={stats.pastDue} />
        <Stat label="Annual revenue (paid members)" value={formatMoney(stats.annualRevenue)} />
        <Stat label="Renewing in 30 days" value={stats.renewingSoon} />
      </div>

      <div className="admin-toolbar">
        <div className="chip-row">
          {filters.map(([key, label]) => (
            <button key={key} type="button" className={`chip${filter === key ? " is-active" : ""}`} onClick={() => setFilter(key)}>
              {label}
            </button>
          ))}
        </div>
        <input type="search" placeholder="Search name, email, city" value={query} onChange={(e) => setQuery(e.target.value)} />
        <a className="button button--outline" href="/api/admin/members.csv">Export CSV</a>
        <button type="button" className="button button--gold button--compact" onClick={() => setAdding(!adding)}>
          {adding ? "Close" : "Add member"}
        </button>
      </div>

      {adding && <AddMember onAdded={reload} />}

      {list.length === 0 ? (
        <p className="admin-empty">
          {stats.total === 0 ? "No members yet. People appear here once their payment goes through." : "No members match."}
        </p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Status</th>
                <th>Plan</th>
                <th>Registered</th>
                <th>Paid through</th>
                <th aria-label="Details" />
              </tr>
            </thead>
            <tbody>
              {list.map((m) => (
                <React.Fragment key={m.id}>
                  <tr>
                    <td>
                      <strong>{m.name || "(no name)"}</strong>
                      <span className="admin-sub">{m.email}</span>
                    </td>
                    <td>
                      <StatusBadge status={m.status} />
                      {m.cancelAtPeriodEnd && <span className="admin-sub">Cancels at renewal</span>}
                    </td>
                    <td>{m.plan ? (m.plan.amount === 0 ? "Complimentary" : `${formatMoney(m.plan.amount)}/${m.plan.interval || "year"}`) : "—"}</td>
                    <td>{formatDate(m.registeredAt)}</td>
                    <td>{formatDate(m.paidThrough)}</td>
                    <td>
                      <div className="admin-actions">
                        <button type="button" className="admin-link" onClick={() => setEmailId(emailId === m.id ? null : m.id)}>
                          {emailId === m.id ? "Close email" : "Email"}
                        </button>
                        <button type="button" className="admin-link" onClick={() => setOpenId(openId === m.id ? null : m.id)}>
                          {openId === m.id ? "Close" : "Details"}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {emailId === m.id && (
                    <tr className="admin-detail-row">
                      <td colSpan={6}>
                        <MemberEmail member={m} onSent={reload} />
                      </td>
                    </tr>
                  )}
                  {openId === m.id && (
                    <tr className="admin-detail-row">
                      <td colSpan={6}>
                        <MemberDetail member={m} onChanged={reload} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }) {
  return (
    <div className="admin-stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function AddMember({ onAdded }) {
  const empty = { name: "", email: "", phone: "", notes: "", amount: String(currentRate().amount) };
  const [form, setForm] = useState(empty);
  const [note, setNote] = useState({ error: "", message: "" });
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const { member, welcomed } = await api("/api/admin/members", { method: "POST", body: form });
      setNote({
        error: "",
        message: `${member.name} is now an active member through ${formatDate(member.paidThrough)}. ${welcomed ? "The welcome email was sent." : "No welcome email was sent (it is switched off in Settings)."}`
      });
      setForm(empty);
      onAdded();
    } catch (err) {
      setNote({ error: err.message, message: "" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="admin-card admin-card--inline" onSubmit={submit}>
      <h2>Add a paid member</h2>
      <p className="admin-sub">For someone who paid you directly (cash, check) or a gifted membership. She becomes an active member for one year right away, and gets the welcome email if it is switched on in Settings. Members who pay through the Join page are added automatically.</p>
      <div className="admin-row">
        <label>Full name<input value={form.name} onChange={set("name")} required maxLength={120} /></label>
        <label>Email<input type="email" value={form.email} onChange={set("email")} required /></label>
      </div>
      <div className="admin-row">
        <label>
          Amount paid for the year ($)
          <input type="number" min="0" step="0.01" value={form.amount} onChange={set("amount")} required />
          <small>Enter 0 for a free (complimentary) membership. Free memberships are not counted in revenue.</small>
        </label>
        <label>Phone (optional)<input value={form.phone} onChange={set("phone")} maxLength={40} /></label>
      </div>
      <label>Note (optional, only admins see it)<input value={form.notes} onChange={set("notes")} placeholder="Paid by check on... / Gifted by..." /></label>
      <div className="member-detail__actions">
        <button type="submit" className="button button--gold" disabled={busy}>{busy ? "Adding..." : "Add member"}</button>
      </div>
      <Notice {...note} />
    </form>
  );
}

function MemberEmail({ member, onSent }) {
  const mail = useApi("/api/admin/mail");
  const [from, setFrom] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState(`Hi ${(member.name || "").trim().split(/\s+/)[0] || "there"},\n\n`);
  const [note, setNote] = useState({ error: "", message: "" });
  const [busy, setBusy] = useState(false);

  const senders = mail.data?.senders || [];
  const sender = from || senders[0] || "";

  async function send(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api(`/api/admin/members/${member.id}/email`, { method: "POST", body: { from: sender, subject, message } });
      setNote({ error: "", message: `Sent to ${member.email} from ${sender}.` });
      setSubject("");
      onSent();
    } catch (err) {
      setNote({ error: err.message, message: "" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="member-email" onSubmit={send}>
      <div className="admin-row">
        <label>
          From
          <select value={sender} onChange={(e) => setFrom(e.target.value)}>
            {senders.map((address) => (
              <option key={address} value={address}>{address}</option>
            ))}
          </select>
          <small>Replies go to this address. Add more sender addresses in Settings.</small>
        </label>
        <label>
          To
          <input value={`${member.name || ""} <${member.email}>`} readOnly />
        </label>
      </div>
      <label>Subject<input value={subject} onChange={(e) => setSubject(e.target.value)} required maxLength={200} /></label>
      <label>Message<textarea rows={8} value={message} onChange={(e) => setMessage(e.target.value)} required /></label>
      <div className="member-detail__actions">
        <button type="submit" className="button button--gold" disabled={busy || !sender}>{busy ? "Sending..." : "Send email"}</button>
        {member.lastEmailedAt && <span className="admin-sub">Last emailed {formatDate(member.lastEmailedAt)}</span>}
      </div>
      <Notice {...note} />
    </form>
  );
}

function MemberDetail({ member, onChanged }) {
  const [notes, setNotes] = useState(member.notes || "");
  const [status, setStatus] = useState(member.status);
  const [amount, setAmount] = useState(member.plan ? String(member.plan.amount) : "");
  const [note, setNote] = useState({ error: "", message: "" });
  const stripeBilled = Boolean(member.stripeSubscriptionId);

  async function sendWelcome() {
    const resend = Boolean(member.welcomeSentAt);
    if (resend && !window.confirm(`${member.email} was already sent the welcome email on ${formatDate(member.welcomeSentAt)}. Send it again?`)) return;
    try {
      await api(`/api/admin/members/${member.id}/welcome`, { method: "POST", body: { resend } });
      setNote({ error: "", message: `Welcome email sent to ${member.email}.` });
      onChanged();
    } catch (err) {
      setNote({ error: err.message, message: "" });
    }
  }

  async function save() {
    try {
      await api(`/api/admin/members/${member.id}`, { method: "PATCH", body: { notes, status, ...(stripeBilled ? {} : { planAmount: amount }) } });
      setNote({ error: "", message: "Saved." });
      onChanged();
    } catch (err) {
      setNote({ error: err.message, message: "" });
    }
  }

  async function remove() {
    if (!window.confirm(`Delete ${member.name || member.email}? This can't be undone.`)) return;
    try {
      await api(`/api/admin/members/${member.id}`, { method: "DELETE" });
      onChanged();
    } catch (err) {
      setNote({ error: err.message, message: "" });
    }
  }

  const address = [member.address, member.address2, [member.city, member.state, member.zip].filter(Boolean).join(" "), member.country]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="member-detail">
      <dl>
        <dt>Phone</dt><dd>{member.phone || "—"}</dd>
        <dt>Address</dt><dd>{address || "—"}</dd>
        <dt>Price at signup</dt><dd>{member.rateAtSignup ? formatMoney(member.rateAtSignup) : "—"}</dd>
        <dt>Activated</dt><dd>{formatDate(member.activatedAt)}</dd>
        <dt>Last payment</dt><dd>{member.lastPaymentAt ? `${formatMoney(member.lastPaymentAmount)} on ${formatDate(member.lastPaymentAt)}` : "—"}</dd>
        <dt>Reminders sent</dt><dd>{member.reminders?.count || 0}{member.reminders?.lastAt ? ` (last ${formatDate(member.reminders.lastAt)})` : ""}</dd>
        <dt>Last portal sign-in</dt><dd>{formatDate(member.lastLoginAt)}</dd>
        <dt>Welcome email</dt><dd>{member.welcomeSentAt ? `Sent ${formatDate(member.welcomeSentAt)}` : "Not sent"}</dd>
        <dt>Came from</dt><dd>{{ stripe: "Paid on Stripe (no Join form)", manual: "Marked paid by an admin" }[member.source] || "Join form, then paid"}</dd>
      </dl>
      <div className="member-detail__edit">
        <label>
          Notes (only admins see these)
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {Object.entries(statusLabels).filter(([key]) => key !== "registered").map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <small>Stripe updates this automatically. Change it by hand only to correct a mistake or for cash/check renewals (marking Active gives one year).</small>
        </label>
        {!stripeBilled && (
          <label>
            Amount paid for the year ($)
            <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <small>Enter 0 for a free (complimentary) membership so it is not counted in revenue.</small>
          </label>
        )}
        <div className="member-detail__actions">
          <button type="button" className="button button--gold" onClick={save}>Save</button>
          {member.status === "active" && (
            <button type="button" className="admin-link" onClick={sendWelcome}>
              {member.welcomeSentAt ? "Resend welcome email" : "Send welcome email"}
            </button>
          )}
          <button type="button" className="admin-link admin-link--danger" onClick={remove}>Delete member</button>
        </div>
        <Notice {...note} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Follow-ups

function FollowUpsTab() {
  const { data, error, reload } = useApi("/api/admin/signups");
  const [note, setNote] = useState({ error: "", message: "" });
  const [busy, setBusy] = useState("");

  const unpaid = data?.signups || [];

  async function run(key, action, message) {
    setBusy(key);
    try {
      await action();
      setNote({ error: "", message });
      reload();
    } catch (err) {
      setNote({ error: err.message, message: "" });
    } finally {
      setBusy("");
    }
  }

  const remind = (signup) =>
    run(signup.id, () => api(`/api/admin/signups/${signup.id}/remind`, { method: "POST" }), `Reminder sent to ${signup.email}.`);

  function markPaid(signup) {
    if (!window.confirm(`Mark ${signup.name || signup.email} as a paid member for one year? Use this only if they paid you directly (cash, check) or you're gifting the membership.`)) return;
    run(signup.id, () => api(`/api/admin/signups/${signup.id}/activate`, { method: "POST" }), `${signup.name || signup.email} is now an active member.`);
  }

  function remove(signup) {
    if (!window.confirm(`Delete the unfinished sign-up for ${signup.name || signup.email}?`)) return;
    run(signup.id, () => api(`/api/admin/signups/${signup.id}`, { method: "DELETE" }), "Sign-up deleted.");
  }

  async function remindAll() {
    if (!window.confirm("Email a reminder to everyone who hasn't paid and wasn't reminded in the last 3 days?")) return;
    setBusy("all");
    try {
      const result = await api("/api/admin/remind-unpaid", { method: "POST", body: { skipDays: 3 } });
      setNote({
        error: result.failed.length ? `Could not email: ${result.failed.join(", ")}` : "",
        message: `Sent ${result.sent} reminder${result.sent === 1 ? "" : "s"}.${result.skipped ? ` Skipped ${result.skipped} reminded recently.` : ""}`
      });
      reload();
    } catch (err) {
      setNote({ error: err.message, message: "" });
    } finally {
      setBusy("");
    }
  }

  if (!data) return <Notice error={error} message={error ? "" : "Loading..."} />;

  return (
    <section>
      <div className="admin-section-head">
        <div>
          <h2>Started but didn&rsquo;t pay</h2>
          <p>
            These people filled in the Join form but never completed payment. They are <strong>not members</strong> and can&rsquo;t sign in.
            A reminder links them back to the Join page. Entries are deleted automatically after {data.keepDays} days.
          </p>
        </div>
        <button type="button" className="button button--gold" onClick={remindAll} disabled={!unpaid.length || busy === "all"}>
          {busy === "all" ? "Sending..." : "Remind everyone"}
        </button>
      </div>
      <Notice {...note} />
      {unpaid.length === 0 ? (
        <p className="admin-empty">Nobody is waiting on payment right now.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Name</th><th>Started</th><th>Reminders</th><th aria-label="Actions" /></tr>
            </thead>
            <tbody>
              {unpaid.map((m) => (
                <tr key={m.id}>
                  <td><strong>{m.name}</strong><span className="admin-sub">{m.email}{m.phone ? ` · ${m.phone}` : ""}</span></td>
                  <td>{formatDate(m.registeredAt)}</td>
                  <td>{m.reminders?.count ? `${m.reminders.count} (last ${formatDate(m.reminders.lastAt)})` : "None yet"}</td>
                  <td>
                    <div className="admin-actions">
                      <button type="button" className="admin-link" onClick={() => remind(m)} disabled={busy === m.id}>
                        {busy === m.id ? "Working..." : "Send reminder"}
                      </button>
                      <button type="button" className="admin-link" onClick={() => markPaid(m)} disabled={busy === m.id}>Mark as paid</button>
                      <button type="button" className="admin-link admin-link--danger" onClick={() => remove(m)} disabled={busy === m.id}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- Events

function EventsTab() {
  const { data, error } = useApi("/api/admin/registrations");
  if (!data) return <Notice error={error} message={error ? "" : "Loading..."} />;

  const byEvent = data.registrations.reduce((groups, r) => {
    (groups[r.event] ||= []).push(r);
    return groups;
  }, {});

  return (
    <section>
      <div className="admin-section-head">
        <div>
          <h2>Event registrations</h2>
          <p>Paid tickets from the event Stripe links, recorded automatically.</p>
        </div>
        <a className="button button--outline" href="/api/admin/registrations.csv">Export CSV</a>
      </div>
      {data.registrations.length === 0 && <p className="admin-empty">No paid registrations yet.</p>}
      {Object.entries(byEvent).map(([event, rows]) => (
        <div key={event} className="admin-group">
          <h3>
            {event}
            <span>
              {rows.reduce((s, r) => s + r.quantity, 0)} tickets · {formatMoney(rows.reduce((s, r) => s + r.amount, 0))}
            </span>
          </h3>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Name</th><th>Tickets</th><th>Paid</th><th>Date</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td><strong>{r.name || "(no name)"}</strong><span className="admin-sub">{r.email}{r.phone ? ` · ${r.phone}` : ""}</span></td>
                    <td>{r.quantity}</td>
                    <td>{formatMoney(r.amount)}</td>
                    <td>{formatDate(r.paidAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </section>
  );
}

// ---------------------------------------------------------------- Shop

function ShopTab() {
  const { data, error, reload } = useApi("/api/admin/shop");
  const [note, setNote] = useState({ error: "", message: "" });

  async function saveStock(product, value) {
    try {
      await api(`/api/admin/shop/stock/${product.id}`, { method: "PUT", body: { stock: value === "" ? null : Number(value) } });
      setNote({ error: "", message: `Stock updated for ${product.name}.` });
      reload();
    } catch (err) {
      setNote({ error: err.message, message: "" });
    }
  }

  async function setShipped(order, shipped) {
    try {
      await api(`/api/admin/shop/orders/${encodeURIComponent(order.id)}`, { method: "PATCH", body: { shipped } });
      reload();
    } catch (err) {
      setNote({ error: err.message, message: "" });
    }
  }

  if (!data) return <Notice error={error} message={error ? "" : "Loading..."} />;
  const toShip = data.orders.filter((o) => o.status !== "shipped").length;
  const money = (cents) => formatMoney(cents / 100);

  return (
    <section>
      <ShopCatalogAdmin data={data} reload={reload} />
      <div className="admin-section-head admin-group--spaced">
        <div>
          <h2>Shop orders</h2>
          <p>{toShip ? `${toShip} order${toShip === 1 ? "" : "s"} waiting to ship.` : "Nothing waiting to ship."} Cart orders arrive here automatically after Stripe confirms payment.</p>
        </div>
      </div>
      <Notice error={error} />
      <Notice {...note} />
      {data.orders.length === 0 ? (
        <p className="admin-empty">No orders yet.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Order</th><th>Items</th><th>Ship to</th><th>Total</th><th aria-label="Status" /></tr>
            </thead>
            <tbody>
              {data.orders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <strong>{o.number}</strong>
                    <span className="admin-sub">{formatDate(o.paidAt)}</span>
                  </td>
                  <td>
                    {o.items.map((i) => (
                      <span key={i.id} className="admin-line">{i.qty} × {i.name}</span>
                    ))}
                    {o.note && <span className="admin-sub">Note: {o.note}</span>}
                    {o.oversold?.length > 0 && (
                      <span className="admin-sub admin-sub--warn">Out of stock when paid: {o.oversold.join(", ")}. Contact the customer.</span>
                    )}
                  </td>
                  <td>
                    <strong>{o.name}</strong>
                    {o.address && (
                      <span className="admin-sub">
                        {[o.address.line1, o.address.line2].filter(Boolean).join(", ")}<br />
                        {[o.address.city, o.address.state].filter(Boolean).join(", ")} {o.address.postal_code}
                      </span>
                    )}
                    <span className="admin-sub">{o.email}{o.phone ? ` · ${o.phone}` : ""}</span>
                  </td>
                  <td>
                    {money(o.totalCents)}
                    <span className="admin-sub">incl. {money(o.shippingCents)} shipping</span>
                  </td>
                  <td>
                    {o.status === "shipped" ? (
                      <>
                        <span className="status-badge status-badge--active">Shipped {formatDate(o.shippedAt)}</span>
                        <button type="button" className="admin-link" onClick={() => setShipped(o, false)}>Undo</button>
                      </>
                    ) : (
                      <button type="button" className="button button--gold" onClick={() => setShipped(o, true)}>Mark shipped</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="admin-group admin-group--spaced">
        <h3>Stock</h3>
        <p className="admin-sub">Stock counts down as orders are paid. Leave a box blank for items you have plenty of; set 0 to mark an item sold out.</p>
        <div className="admin-stock">
          {data.products.map((p) => (
            <StockRow key={p.id} product={p} onSave={saveStock} />
          ))}
        </div>
      </div>
    </section>
  );
}

function StockRow({ product, onSave }) {
  const [value, setValue] = useState(product.stock === null ? "" : String(product.stock));
  useEffect(() => setValue(product.stock === null ? "" : String(product.stock)), [product.stock]);
  return (
    <form className="admin-stock__row" onSubmit={(e) => { e.preventDefault(); onSave(product, value); }}>
      <div>
        <strong>{product.name}</strong>
        <span className="admin-sub">{formatMoney(product.price / 100)}</span>
      </div>
      <input type="number" min="0" step="1" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Plenty" aria-label={`Stock for ${product.name}`} />
      <button type="submit" className="admin-link">Save</button>
    </form>
  );
}

// ---------------------------------------------------------------- Portal events

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DATE_MODES = [
  ["exact", "An exact date"],
  ["month", "A month and year (no exact date yet)"],
  ["year", "A year only"],
  ["tba", "To be announced (TBA)"]
];

const emptyEvent = {
  title: "", dateMode: "exact", date: "", startTime: "", endTime: "", location: "", locationTbd: false,
  description: "", link: "", linkLabel: "", image: ""
};

// "When is it?": an exact day, just a month, just a year, or to be announced.
function EventDateFields({ form, setForm }) {
  const mode = eventMode(form);
  const now = new Date();
  const thisYear = now.getFullYear();
  const parts = /^\d{4}(-\d{2})?$/.test(form.date) ? form.date.split("-") : [];
  const selYear = parts[0] || String(thisYear);
  const selMonth = parts[1] || String(now.getMonth() + 1).padStart(2, "0");
  const years = [...new Set([...Array.from({ length: 8 }, (_, i) => String(thisYear + i)), selYear])].sort();

  function changeMode(next) {
    let date = "";
    if (next === "exact") date = mode === "exact" ? form.date : "";
    if (next === "month") date = `${selYear}-${selMonth}`;
    if (next === "year") date = selYear;
    setForm({ ...form, dateMode: next, date, ...(next === "exact" ? {} : { startTime: "", endTime: "" }) });
  }

  const yearSelect = (value, onChange) => (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {years.map((y) => <option key={y} value={y}>{y}</option>)}
    </select>
  );

  return (
    <>
      <div className="admin-row">
        <label>
          When is it?
          <select value={mode} onChange={(e) => changeMode(e.target.value)}>
            {DATE_MODES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        {mode === "exact" && (
          <label>Date<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></label>
        )}
        {mode === "month" && (
          <div className="admin-row">
            <label>
              Month
              <select value={selMonth} onChange={(e) => setForm({ ...form, date: `${selYear}-${e.target.value}` })}>
                {MONTH_NAMES.map((name, i) => <option key={name} value={String(i + 1).padStart(2, "0")}>{name}</option>)}
              </select>
            </label>
            <label>Year{yearSelect(selYear, (y) => setForm({ ...form, date: `${y}-${selMonth}` }))}</label>
          </div>
        )}
        {mode === "year" && <label>Year{yearSelect(selYear, (y) => setForm({ ...form, date: y }))}</label>}
      </div>
      {mode !== "exact" && (
        <p className="admin-sub">
          {mode === "month" && "Members will see just the month and year. It leaves the portal when that month is over."}
          {mode === "year" && "Members will see just the year. It leaves the portal when that year is over."}
          {mode === "tba" && "Members will see \u201cDate to be announced.\u201d It stays in the portal until you give it a date, archive it or delete it."}
          {" "}Switch to an exact date when it is confirmed.
        </p>
      )}
    </>
  );
}

function PortalEventsTab() {
  const { data, error, reload } = useApi("/api/admin/events");
  const [form, setForm] = useState(null); // null = editor closed
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState({ error: "", message: "" });

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  function openNew(from = emptyEvent) {
    setEditingId(null);
    setForm({ ...from });
    setNote({ error: "", message: "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function edit(event) {
    setEditingId(event.id);
    setForm({ ...emptyEvent, ...event });
    setNote({ error: "", message: "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const duplicate = (event) =>
    openNew({ ...emptyEvent, ...event, date: eventMode(event) === "exact" ? "" : event.date, id: undefined, status: undefined, isPast: undefined });

  function closeEditor() {
    setForm(null);
    setEditingId(null);
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(editingId ? `/api/admin/events/${editingId}` : "/api/admin/events", { method: editingId ? "PUT" : "POST", body: form });
      setNote({ error: "", message: editingId ? "Event updated." : "Event added. It is showing in the member portal now." });
      closeEditor();
      reload();
    } catch (err) {
      setNote({ error: err.message, message: "" });
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(event, status) {
    try {
      await api(`/api/admin/events/${event.id}/status`, { method: "PATCH", body: { status } });
      setNote({
        error: "",
        message: status === "archived" ? `"${event.title}" is archived and no longer shown to members.` : `"${event.title}" is showing in the portal again.`
      });
      reload();
    } catch (err) {
      setNote({ error: err.message, message: "" });
    }
  }

  async function remove(event) {
    if (!window.confirm(`Delete "${event.title}" permanently? This can't be undone. To just hide it, use Archive instead.`)) return;
    try {
      await api(`/api/admin/events/${event.id}`, { method: "DELETE" });
      if (editingId === event.id) closeEditor();
      setNote({ error: "", message: `"${event.title}" was deleted.` });
      reload();
    } catch (err) {
      setNote({ error: err.message, message: "" });
    }
  }

  async function uploadImage(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const body = new FormData();
      body.append("image", file);
      const res = await fetch("/api/admin/events/image", { method: "POST", body, credentials: "same-origin" });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || "The photo could not be uploaded.");
      setForm((f) => ({ ...f, image: result.image }));
    } catch (err) {
      setNote({ error: err.message, message: "" });
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <Notice error={error} message={error ? "" : "Loading..."} />;

  const showing = data.events.filter((e) => e.status === "published" && !e.isPast);
  const past = data.events.filter((e) => e.status === "published" && e.isPast);
  const archived = data.events.filter((e) => e.status === "archived");

  const Row = ({ event, actions }) => {
    const badge = eventBadge(event);
    const time = eventMode(event) === "exact" ? formatEventTime(event.startTime, event.endTime) : "";
    const where = event.locationTbd ? "Location to be determined" : event.location;
    return (
      <li className="event-row">
        <div className="event-row__date">
          {badge.top && <span>{badge.top}</span>}
          <strong className={badge.big.length > 3 ? "is-long" : ""}>{badge.big}</strong>
        </div>
        <div className="event-row__main">
          <strong>{event.title}</strong>
          <span className="admin-sub">
            {formatEventWhen(event, "short")}
            {time ? ` · ${time}` : ""}
            {where ? ` · ${where}` : ""}
          </span>
        </div>
        <div className="admin-actions">{actions}</div>
      </li>
    );
  };

  const link = (label, onClick, danger) => (
    <button type="button" className={`admin-link${danger ? " admin-link--danger" : ""}`} onClick={onClick}>{label}</button>
  );

  return (
    <section>
      <div className="admin-section-head">
        <div>
          <h2>Portal events</h2>
          <p>Events shown to members in the member portal. An event stays up until its date passes. Archive hides one but keeps it; Delete removes it for good.</p>
        </div>
        {!form && <button type="button" className="button button--gold" onClick={() => openNew()}>Add event</button>}
      </div>
      <Notice {...note} />

      {form && (
        <div className="event-editor">
          <form className="admin-card" onSubmit={save}>
            <h2>{editingId ? "Edit event" : "New event"}</h2>
            <label>Title<input value={form.title} onChange={set("title")} required maxLength={120} placeholder="Twilight Nine & Wine" /></label>
            <EventDateFields form={form} setForm={setForm} />
            <div className="admin-row">
              <label>
                Start time (optional)
                <input type="time" value={form.startTime} onChange={set("startTime")} disabled={eventMode(form) !== "exact"} />
              </label>
              <label>
                End time (optional)
                <input type="time" value={form.endTime} onChange={set("endTime")} disabled={!form.startTime || eventMode(form) !== "exact"} />
              </label>
            </div>
            <label>
              Location (optional)
              <input value={form.location} onChange={set("location")} maxLength={160} placeholder="The Country Club at Woodmore" disabled={Boolean(form.locationTbd)} />
            </label>
            <label className="admin-check">
              <input
                type="checkbox"
                checked={Boolean(form.locationTbd)}
                onChange={(e) => setForm({ ...form, locationTbd: e.target.checked, location: e.target.checked ? "" : form.location })}
              />
              Location to be determined (TBD)
            </label>
            <label>
              Description (optional)
              <textarea rows={5} value={form.description} onChange={set("description")} maxLength={3000} placeholder="What to expect, what to bring, who it is for..." />
            </label>
            <div className="admin-row">
              <label>
                RSVP or details link (optional)
                <input type="url" value={form.link} onChange={set("link")} placeholder="https://..." />
              </label>
              <label>
                Button wording
                <input value={form.linkLabel} onChange={set("linkLabel")} maxLength={40} placeholder="RSVP & details" disabled={!form.link} />
              </label>
            </div>
            <div className="event-editor__photo">
              <span>Photo (optional)</span>
              <div className="member-detail__actions">
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadImage} disabled={busy} aria-label="Upload a photo" />
                {form.image && <button type="button" className="admin-link admin-link--danger" onClick={() => setForm({ ...form, image: "" })}>Remove photo</button>}
              </div>
              <small className="admin-sub">JPG, PNG or WebP, up to 5 MB. A wide (landscape) photo looks best.</small>
            </div>
            <div className="member-detail__actions">
              <button className="button button--gold" type="submit" disabled={busy}>{busy ? "Saving..." : editingId ? "Save changes" : "Add event"}</button>
              <button type="button" className="admin-link" onClick={closeEditor}>Cancel</button>
            </div>
          </form>
          <div className="event-editor__preview">
            <span className="admin-sub">Preview: how members will see it</span>
            <EventCard event={form} preview />
          </div>
        </div>
      )}

      <div className="admin-group">
        <h3>Showing in the portal <span>{showing.length}</span></h3>
        {showing.length === 0 ? (
          <p className="admin-empty">Nothing is showing. Members see &ldquo;No upcoming events&rdquo;. Add an event to get started.</p>
        ) : (
          <ul className="event-rows">
            {showing.map((e) => (
              <Row key={e.id} event={e} actions={<>{link("Edit", () => edit(e))}{link("Duplicate", () => duplicate(e))}{link("Archive", () => setStatus(e, "archived"))}{link("Delete", () => remove(e), true)}</>} />
            ))}
          </ul>
        )}
      </div>

      {past.length > 0 && (
        <div className="admin-group">
          <h3>Past events <span>{past.length} no longer shown to members</span></h3>
          <ul className="event-rows">
            {past.map((e) => (
              <Row key={e.id} event={e} actions={<>{link("Duplicate", () => duplicate(e))}{link("Archive", () => setStatus(e, "archived"))}{link("Delete", () => remove(e), true)}</>} />
            ))}
          </ul>
        </div>
      )}

      {archived.length > 0 && (
        <div className="admin-group">
          <h3>Archived <span>{archived.length} hidden, kept for later</span></h3>
          <ul className="event-rows">
            {archived.map((e) => (
              <Row
                key={e.id}
                event={e}
                actions={
                  <>
                    {link("Edit", () => edit(e))}
                    {link("Restore", () => setStatus(e, "published"))}
                    {link("Duplicate", () => duplicate(e))}
                    {link("Delete", () => remove(e), true)}
                  </>
                }
              />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- Offers

const emptyOffer = { title: "", category: "Offer", description: "", code: "", link: "", eventDate: "", expiresOn: "", active: true };

function OffersTab() {
  const { data, error, reload } = useApi("/api/admin/offers");
  const [form, setForm] = useState(emptyOffer);
  const [editingId, setEditingId] = useState(null);
  const [note, setNote] = useState({ error: "", message: "" });

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  async function submit(event) {
    event.preventDefault();
    try {
      await api(editingId ? `/api/admin/offers/${editingId}` : "/api/admin/offers", {
        method: editingId ? "PUT" : "POST",
        body: form
      });
      setNote({ error: "", message: editingId ? "Offer updated." : "Offer added. Members can see it now." });
      setForm(emptyOffer);
      setEditingId(null);
      reload();
    } catch (err) {
      setNote({ error: err.message, message: "" });
    }
  }

  async function remove(offer) {
    if (!window.confirm(`Delete "${offer.title}"?`)) return;
    await api(`/api/admin/offers/${offer.id}`, { method: "DELETE" }).catch((err) => setNote({ error: err.message, message: "" }));
    reload();
  }

  function edit(offer) {
    setEditingId(offer.id);
    setForm({ ...emptyOffer, ...offer });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <section className="admin-split">
      <form className="admin-card" onSubmit={submit}>
        <h2>{editingId ? "Edit offer" : "Add an offer"}</h2>
        <label>Title<input value={form.title} onChange={set("title")} required maxLength={120} placeholder="15% off at Pro Shop" /></label>
        <label>
          Type
          <select value={form.category} onChange={set("category")}>
            <option>Offer</option>
            <option>Discount code</option>
          </select>
        </label>
        <label>Details<textarea rows={4} value={form.description} onChange={set("description")} maxLength={1500} /></label>
        <label>Discount code (optional)<input value={form.code} onChange={set("code")} maxLength={60} placeholder="LOTG15" /></label>
        <label>Link (optional)<input value={form.link} onChange={set("link")} placeholder="https://..." /></label>
        <label>Hide after (optional)<input type="date" value={form.expiresOn} onChange={set("expiresOn")} /></label>
        <label className="admin-check"><input type="checkbox" checked={form.active} onChange={set("active")} /> Visible to members</label>
        <div className="member-detail__actions">
          <button className="button button--gold" type="submit">{editingId ? "Save changes" : "Add offer"}</button>
          {editingId && (
            <button type="button" className="admin-link" onClick={() => { setEditingId(null); setForm(emptyOffer); }}>Cancel</button>
          )}
        </div>
        <Notice {...note} />
      </form>

      <div>
        <h2>Current offers</h2>
        {!data && <Notice error={error} message={error ? "" : "Loading..."} />}
        {data?.offers.length === 0 && <p className="admin-empty">No offers yet. Add one and it appears in the member portal.</p>}
        <ul className="admin-offers">
          {data?.offers.map((o) => (
            <li key={o.id} className={o.active ? "" : "is-hidden"}>
              <div>
                <span className="admin-sub">{o.category}{o.active ? "" : " · hidden"}{o.expiresOn ? ` · until ${formatDate(o.expiresOn + "T12:00")}` : ""}</span>
                <strong>{o.title}</strong>
                {o.code && <code>{o.code}</code>}
              </div>
              <div className="admin-offers__actions">
                <button type="button" className="admin-link" onClick={() => edit(o)}>Edit</button>
                <button type="button" className="admin-link admin-link--danger" onClick={() => remove(o)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- Announcements

function AnnouncementsTab() {
  const { data, error, reload } = useApi("/api/admin/announcements");
  const members = useApi("/api/admin/members");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [note, setNote] = useState({ error: "", message: "" });
  const [busy, setBusy] = useState(false);

  const recipients = (members.data?.members || []).filter((m) => m.status === "active" || m.status === "past_due").length;
  const sending = data?.announcements.some((a) => a.status === "sending");

  // Refresh the history while a send is in progress.
  useEffect(() => {
    if (!sending) return undefined;
    const timer = setInterval(reload, 3000);
    return () => clearInterval(timer);
  }, [sending, reload]);

  async function submit(event) {
    event.preventDefault();
    if (!window.confirm(`Email "${subject}" to ${recipients} active member${recipients === 1 ? "" : "s"}?`)) return;
    setBusy(true);
    try {
      await api("/api/admin/announcements", { method: "POST", body: { subject, message } });
      setNote({ error: "", message: "Sending now. Progress shows below." });
      setSubject("");
      setMessage("");
      reload();
    } catch (err) {
      setNote({ error: err.message, message: "" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-split">
      <form className="admin-card" onSubmit={submit}>
        <h2>Email active members</h2>
        <p className="admin-sub">Goes to {recipients} active member{recipients === 1 ? "" : "s"}, one email each, starting &ldquo;Hi [first name]&rdquo; and ending with a link to the member portal.</p>
        <label>Subject<input value={subject} onChange={(e) => setSubject(e.target.value)} required maxLength={200} /></label>
        <label>Message<textarea rows={8} value={message} onChange={(e) => setMessage(e.target.value)} required /></label>
        <button className="button button--gold" type="submit" disabled={busy || !recipients}>
          {busy ? "Starting..." : "Send announcement"}
        </button>
        <Notice {...note} />
      </form>
      <div>
        <h2>Sent</h2>
        {!data && <Notice error={error} message={error ? "" : "Loading..."} />}
        {data?.announcements.length === 0 && <p className="admin-empty">No announcements sent yet.</p>}
        <ul className="admin-offers">
          {data?.announcements.map((a) => (
            <li key={a.id}>
              <div>
                <span className="admin-sub">{formatDate(a.createdAt)} · {a.status === "sending" ? `Sending... ${a.sent}/${a.recipients}` : `Sent to ${a.sent} of ${a.recipients}${a.failed ? `, ${a.failed} failed` : ""}`}</span>
                <strong>{a.subject}</strong>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- Settings

function SettingsTab() {
  const { data, error, reload } = useApi("/api/admin/status");
  const [note, setNote] = useState({ error: "", message: "" });
  const [busy, setBusy] = useState(false);

  async function runSync() {
    setBusy(true);
    try {
      const { result } = await api("/api/admin/stripe/sync", { method: "POST" });
      setNote({ error: "", message: `Done: ${result.membership} membership payment${result.membership === 1 ? "" : "s"} and ${result.event} event ticket${result.event === 1 ? "" : "s"} checked.` });
      reload();
    } catch (err) {
      setNote({ error: err.message, message: "" });
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <Notice error={error} message={error ? "" : "Loading..."} />;

  const checks = [
    ["Stripe connected", data.stripeConfigured, "Add STRIPE_SECRET_KEY to the server settings."],
    ["Stripe payment updates (webhook)", data.webhookConfigured, "Add STRIPE_WEBHOOK_SECRET to the server settings."],
    ["Email sending", data.mailWorking, data.mailConfigured ? data.mailError : "Add the SMTP settings so sign-in links and reminders can be emailed."],
    ["Separate admin password", data.separateAdminPassword, "Using the magazine password. Set ADMIN_PASSWORD to give the dashboard its own."]
  ];

  return (
    <>
    <section className="admin-split">
      <div className="admin-card">
        <h2>Setup checklist</h2>
        <ul className="admin-checks">
          {checks.map(([label, ok, fix]) => (
            <li key={label} className={ok ? "is-ok" : "is-missing"}>
              <strong>{ok ? "✓" : "!"} {label}</strong>
              {!ok && <span>{fix}</span>}
            </li>
          ))}
        </ul>
        <p className="admin-sub">
          Last payment update from Stripe: {data.lastWebhookAt ? `${formatDate(data.lastWebhookAt)} (${data.lastWebhookType})` : "none received yet"}
        </p>
      </div>
      <div className="admin-card">
        <h2>Sync with Stripe</h2>
        <p>Pulls in every payment made through the Ladies On The Green membership and event links, including ones from before this dashboard existed. Safe to run any time; nothing is duplicated.</p>
        <button type="button" className="button button--gold" onClick={runSync} disabled={busy || !data.stripeConfigured}>
          {busy ? "Syncing..." : "Sync now"}
        </button>
        {data.lastSyncAt && <p className="admin-sub">Last sync: {formatDate(data.lastSyncAt)}</p>}
        <Notice {...note} />
      </div>
    </section>
    <MailSettings />
    </>
  );
}

function MailSettings() {
  const { data, error, reload } = useApi("/api/admin/mail");
  const [newSender, setNewSender] = useState("");
  const [welcome, setWelcome] = useState(null);
  const [testTo, setTestTo] = useState("");
  const [senderNote, setSenderNote] = useState({ error: "", message: "" });
  const [welcomeNote, setWelcomeNote] = useState({ error: "", message: "" });

  useEffect(() => {
    if (data && !welcome) setWelcome(data.welcome);
  }, [data, welcome]);

  if (!data || !welcome) return <Notice error={error} message={error ? "" : "Loading email settings..."} />;

  async function saveSenders(senders, message) {
    try {
      await api("/api/admin/mail", { method: "PUT", body: { senders } });
      setSenderNote({ error: "", message });
      setNewSender("");
      reload();
    } catch (err) {
      setSenderNote({ error: err.message, message: "" });
    }
  }

  function addSender(event) {
    event.preventDefault();
    const address = newSender.trim().toLowerCase();
    if (address) saveSenders([...data.senders, address], `${address} added.`);
  }

  async function saveWelcome(event) {
    event.preventDefault();
    try {
      const saved = await api("/api/admin/mail", { method: "PUT", body: { welcome } });
      setWelcome(saved.welcome);
      setWelcomeNote({
        error: "",
        message: saved.welcome.enabled ? "Saved. New members will get this email automatically." : "Saved. The welcome email is switched off."
      });
      reload();
    } catch (err) {
      setWelcomeNote({ error: err.message, message: "" });
    }
  }

  async function sendTest() {
    try {
      await api("/api/admin/mail", { method: "PUT", body: { welcome } }); // test what is on screen
      await api("/api/admin/mail/welcome-test", { method: "POST", body: { to: testTo } });
      setWelcomeNote({ error: "", message: `Test sent to ${testTo}. It uses sample details ("Test Member").` });
    } catch (err) {
      setWelcomeNote({ error: err.message, message: "" });
    }
  }

  const set = (key) => (e) => setWelcome({ ...welcome, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  return (
    <>
    <section className="admin-split admin-split--spaced">
      <div className="admin-card">
        <h2>Sender addresses</h2>
        <p>The addresses you can send member email from. {data.domain ? `They must end in @${data.domain}, and each should be a real inbox or forward so replies reach someone.` : ""}</p>
        <ul className="admin-offers">
          {data.senders.map((address) => (
            <li key={address}>
              <div><strong>{address}</strong>{address === data.defaultSender && <span className="admin-sub">The site's own address (sign-in links and reminders)</span>}</div>
              {address !== data.defaultSender && (
                <button type="button" className="admin-link admin-link--danger" onClick={() => saveSenders(data.senders.filter((a) => a !== address), `${address} removed.`)}>
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
        <form className="admin-inline-form" onSubmit={addSender}>
          <input type="email" value={newSender} onChange={(e) => setNewSender(e.target.value)} placeholder={data.domain ? `membership@${data.domain}` : "address@yourdomain.com"} aria-label="New sender address" required />
          <button type="submit" className="button button--outline">Add</button>
        </form>
        <Notice {...senderNote} />
      </div>

      <form className="admin-card" onSubmit={saveWelcome}>
        <h2>Welcome email</h2>
        <p>Sent automatically, once, when someone becomes a paid member (through Stripe or &ldquo;Mark as paid&rdquo;).</p>
        <label className="admin-check"><input type="checkbox" checked={welcome.enabled} onChange={set("enabled")} /> Send the welcome email to new members</label>
        <label>
          From
          <select value={welcome.from} onChange={set("from")}>
            {data.senders.map((address) => (
              <option key={address} value={address}>{address}</option>
            ))}
          </select>
        </label>
        <label>Subject<input value={welcome.subject} onChange={set("subject")} required maxLength={200} /></label>
        <label>Message<textarea rows={12} value={welcome.body} onChange={set("body")} required /></label>
        <p className="admin-sub">
          These are filled in for each member: {data.placeholders.map(([token, meaning]) => `${token} = ${meaning}`).join("; ")}.
        </p>
        <div className="member-detail__actions">
          <button type="submit" className="button button--gold">Save</button>
        </div>
        <div className="admin-inline-form">
          <input type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="Send a test to..." aria-label="Send a test to" />
          <button type="button" className="button button--outline" onClick={sendTest} disabled={!testTo}>Send test</button>
        </div>
        <Notice {...welcomeNote} />
      </form>
    </section>
    <WelcomeExisting saved={data.welcome} />
    </>
  );
}

function WelcomeExisting({ saved }) {
  const { data, error, reload } = useApi("/api/admin/mail/welcome-existing");
  const [picked, setPicked] = useState(null); // null until the list has loaded
  const [note, setNote] = useState({ error: "", message: "" });
  const [busy, setBusy] = useState(false);
  const job = data?.job;
  const running = Boolean(job?.running);

  useEffect(() => {
    if (data && picked === null) setPicked(new Set(data.pending.map((p) => p.id)));
  }, [data, picked]);

  // Keep the progress fresh while a send is running.
  useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(reload, 2000);
    return () => clearInterval(timer);
  }, [running, reload]);

  if (!data || picked === null) return <Notice error={error} message={error ? "" : "Loading..."} />;

  const pending = data.pending;
  const chosen = pending.filter((p) => picked.has(p.id));
  const toggle = (id) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  };

  async function send() {
    const label = saved?.subject ? `"${saved.subject}"` : "the welcome email";
    if (!window.confirm(`Send ${label} from ${saved?.from || "the site address"} to ${chosen.length} member${chosen.length === 1 ? "" : "s"} now?`)) return;
    setBusy(true);
    try {
      await api("/api/admin/mail/welcome-existing", { method: "POST", body: { ids: chosen.map((p) => p.id) } });
      setNote({ error: "", message: "" });
      reload();
    } catch (err) {
      setNote({ error: err.message, message: "" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-card admin-card--inline admin-card--spaced">
      <h2>Send the welcome email to existing members</h2>
      <p>
        These active members were paid before the welcome email existed, or have not been sent it yet. Untick anyone who shouldn&rsquo;t get it
        (for example test members). Each member is only ever sent it once, and this works even if &ldquo;Send the welcome email to new members&rdquo; above is unticked.
      </p>
      <p className="admin-sub">It sends the <strong>saved</strong> welcome email above, so save any changes there first and use &ldquo;Send test&rdquo; to check it.</p>

      {pending.length === 0 ? (
        <p className="admin-empty">Every active member has already been sent the welcome email.</p>
      ) : (
        <>
          <div className="member-detail__actions">
            <button type="button" className="admin-link" onClick={() => setPicked(new Set(pending.map((p) => p.id)))}>Select all</button>
            <button type="button" className="admin-link" onClick={() => setPicked(new Set())}>Select none</button>
            <span className="admin-sub">{chosen.length} of {pending.length} selected</span>
          </div>
          <ul className="welcome-list">
            {pending.map((p) => (
              <li key={p.id}>
                <label className="admin-check">
                  <input type="checkbox" checked={picked.has(p.id)} onChange={() => toggle(p.id)} disabled={running} />
                  <span>
                    <strong>{p.name || "(no name)"}</strong>
                    <span className="admin-sub">{p.email}{p.complimentary ? " · Complimentary" : ""}{p.activatedAt ? ` · joined ${formatDate(p.activatedAt)}` : ""}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="member-detail__actions">
            <button type="button" className="button button--gold" onClick={send} disabled={busy || running || chosen.length === 0}>
              {running ? "Sending..." : `Send to ${chosen.length} member${chosen.length === 1 ? "" : "s"}`}
            </button>
          </div>
        </>
      )}

      {job && (
        <p className={`form-status form-status--${job.running ? "idle" : job.failed ? "error" : "success"}`} role="status">
          {job.running
            ? `Sending... ${job.sent + job.failed + job.skipped} of ${job.total}`
            : `Done: ${job.sent} sent${job.skipped ? `, ${job.skipped} skipped (already sent)` : ""}${job.failed ? `, ${job.failed} failed (${job.failedEmails.join(", ")})` : ""}.`}
        </p>
      )}
      <Notice {...note} />
    </section>
  );
}
