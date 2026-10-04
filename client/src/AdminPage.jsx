import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api, formatDate, formatMoney, statusLabels } from "./api.js";

const tabs = ["Members", "Follow-ups", "Events", "Offers", "Announcements", "Settings"];

export default function AdminPage() {
  const [signedIn, setSignedIn] = useState(null); // null = checking
  const [tab, setTab] = useState("Members");

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
          <img src="/ladiesonthegreen.png" alt="" />
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
        {tab === "Events" && <EventsTab />}
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
        <img src="/ladiesonthegreen.png" alt="Ladies On The Green" />
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
    ["registered", `Not paid (${stats.registered})`],
    ["past_due", `Past due (${stats.pastDue})`],
    ["canceled", `Canceled (${stats.canceled})`]
  ];

  return (
    <section>
      <div className="admin-stats">
        <Stat label="Active members" value={stats.active} />
        <Stat label="Registered, not paid" value={stats.registered} />
        <Stat label="Past due" value={stats.pastDue} />
        <Stat label="Annual revenue" value={formatMoney(stats.annualRevenue)} />
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
      </div>

      {list.length === 0 ? (
        <p className="admin-empty">
          {stats.total === 0 ? "No members yet. Applications from the Join page and Stripe payments will appear here." : "No members match."}
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
                    <td>{m.plan ? `${formatMoney(m.plan.amount)}/${m.plan.interval || "year"}` : "—"}</td>
                    <td>{formatDate(m.registeredAt)}</td>
                    <td>{formatDate(m.paidThrough)}</td>
                    <td>
                      <button type="button" className="admin-link" onClick={() => setOpenId(openId === m.id ? null : m.id)}>
                        {openId === m.id ? "Close" : "Details"}
                      </button>
                    </td>
                  </tr>
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

function MemberDetail({ member, onChanged }) {
  const [notes, setNotes] = useState(member.notes || "");
  const [status, setStatus] = useState(member.status);
  const [note, setNote] = useState({ error: "", message: "" });

  async function save() {
    try {
      await api(`/api/admin/members/${member.id}`, { method: "PATCH", body: { notes, status } });
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
        <dt>Came from</dt><dd>{member.source === "stripe" ? "Paid on Stripe (no Join form)" : "Join form"}</dd>
      </dl>
      <div className="member-detail__edit">
        <label>
          Notes (only admins see these)
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {Object.entries(statusLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <small>Stripe updates this automatically. Change it by hand only for cash/check payments or comps (marking Active gives one year).</small>
        </label>
        <div className="member-detail__actions">
          <button type="button" className="button button--gold" onClick={save}>Save</button>
          <button type="button" className="admin-link admin-link--danger" onClick={remove}>Delete member</button>
        </div>
        <Notice {...note} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Follow-ups

function FollowUpsTab() {
  const { data, error, reload } = useApi("/api/admin/members");
  const [note, setNote] = useState({ error: "", message: "" });
  const [busy, setBusy] = useState("");

  const unpaid = (data?.members || []).filter((m) => m.status === "registered");

  async function remind(member) {
    setBusy(member.id);
    try {
      await api(`/api/admin/members/${member.id}/remind`, { method: "POST" });
      setNote({ error: "", message: `Reminder sent to ${member.email}.` });
      reload();
    } catch (err) {
      setNote({ error: err.message, message: "" });
    } finally {
      setBusy("");
    }
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
          <h2>Registered but not paid</h2>
          <p>These people filled in the Join form but haven&rsquo;t completed payment. A reminder links them back to the Join page and mentions the founding-rate deadline while it lasts.</p>
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
              <tr><th>Name</th><th>Registered</th><th>Reminders</th><th aria-label="Actions" /></tr>
            </thead>
            <tbody>
              {unpaid.map((m) => (
                <tr key={m.id}>
                  <td><strong>{m.name}</strong><span className="admin-sub">{m.email}{m.phone ? ` · ${m.phone}` : ""}</span></td>
                  <td>{formatDate(m.registeredAt)}</td>
                  <td>{m.reminders?.count ? `${m.reminders.count} (last ${formatDate(m.reminders.lastAt)})` : "None yet"}</td>
                  <td>
                    <button type="button" className="admin-link" onClick={() => remind(m)} disabled={busy === m.id}>
                      {busy === m.id ? "Sending..." : "Send reminder"}
                    </button>
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
            <option>Event</option>
          </select>
        </label>
        <label>Details<textarea rows={4} value={form.description} onChange={set("description")} maxLength={1500} /></label>
        <label>Discount code (optional)<input value={form.code} onChange={set("code")} maxLength={60} placeholder="LOTG15" /></label>
        <label>Link (optional)<input value={form.link} onChange={set("link")} placeholder="https://..." /></label>
        <div className="admin-row">
          <label>Event date (optional)<input type="date" value={form.eventDate} onChange={set("eventDate")} /></label>
          <label>Hide after (optional)<input type="date" value={form.expiresOn} onChange={set("expiresOn")} /></label>
        </div>
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
    ["Email sending", data.mailConfigured, "Add the SMTP settings so sign-in links and reminders can be emailed."],
    ["Separate admin password", data.separateAdminPassword, "Using the magazine password. Set ADMIN_PASSWORD to give the dashboard its own."]
  ];

  return (
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
  );
}
