import React, { useCallback, useEffect, useState } from "react";
import { api } from "./api.js";
import "./magazine-list-admin.css";

const dateTime = (value) => new Date(value).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
export default function MagazineListAdmin() {
  const [data, setData] = useState(null), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [selected, setSelected] = useState([]), [busy, setBusy] = useState(false);
  const [subject, setSubject] = useState("The Collective Magazine is now available");
  const [message, setMessage] = useState("The Collective Magazine is here! Discover inspiring stories, golf, travel, wellness, business, and the women who connect us.\n\nExplore the magazine and subscription details:\nhttps://ladiesonthegreen.com/subscribe\n\nThank you for being part of our collective.");
  const [preview, setPreview] = useState(null);
  const reload = useCallback(async () => {
    const next = await api("/api/admin/magazine-list"); setData(next);
    setSelected((ids) => ids.filter((id) => next.subscribers.some((s) => s.id === id)));
  }, []);
  useEffect(() => { reload().catch((err) => setError(err.message)); }, [reload]);
  const sending = data?.mailings?.some((m) => m.status === "sending");
  useEffect(() => { if (!sending) return; const interval = setInterval(() => reload().catch((err) => setError(err.message)), 2000); return () => clearInterval(interval); }, [sending, reload]);
  function select(ids) { setSelected(ids); setPreview(null); }
  async function remove(subscriber) {
    if (!window.confirm(`Permanently delete ${subscriber.firstName} ${subscriber.lastName} (${subscriber.email}) from the magazine list? They will no longer receive future list emails.`)) return;
    setBusy(true); setError(""); setNotice("");
    try { await api(`/api/admin/magazine-list/${subscriber.id}`, { method: "DELETE" }); setPreview(null); await reload(); setNotice("Subscriber deleted."); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  function prepare(event) {
    event.preventDefault(); setError(""); setNotice("");
    const recipients = data.subscribers.filter((s) => selected.includes(s.id));
    if (!recipients.length) return setError("Select at least one subscriber to email.");
    setPreview({ subject: subject.trim(), message: message.trim(), recipients, requestId: crypto.randomUUID() });
  }
  async function send() {
    if (!window.confirm(`Send “${preview.subject}” to ${preview.recipients.length} selected subscriber(s) now? Each person receives a separate email.`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await api("/api/admin/magazine-list/email", { method: "POST", body: { subject: preview.subject, message: preview.message, subscriberIds: preview.recipients.map((s) => s.id), requestId: preview.requestId } });
      setPreview(null); await reload(); setNotice("Email batch started. Delivery progress appears in Send history below.");
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <section className="magazine-list-admin"><h1>Magazine interest list</h1><p>Manage the list and email subscribers when the magazine is available. No payment has been collected.</p><a href="/subscribe" target="_blank" rel="noreferrer">Open subscription page ↗</a>
    {error && <p role="alert" className="magazine-list-error">{error}</p>}{notice && <p role="status">{notice}</p>}{!data && !error && <p role="status">Loading the list…</p>}
    {data && <><h2>{data.subscribers.length} {data.subscribers.length === 1 ? "person" : "people"} on the list</h2><p>Select the people to email below. Delete removes a subscriber from future list emails.</p>
      <div className="magazine-list-table"><table className="admin-table"><thead><tr><th scope="col"><input aria-label="Select all subscribers" type="checkbox" disabled={busy || !data.subscribers.length} checked={data.subscribers.length > 0 && selected.length === data.subscribers.length} onChange={(e) => select(e.target.checked ? data.subscribers.map((s) => s.id) : [])} /></th><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Joined (Eastern Time)</th><th scope="col">Actions</th></tr></thead><tbody>{data.subscribers.map((s) => <tr key={s.id}><td><input type="checkbox" aria-label={`Select ${s.email}`} disabled={busy} checked={selected.includes(s.id)} onChange={(e) => select(e.target.checked ? [...selected, s.id] : selected.filter((id) => id !== s.id))} /></td><td>{s.firstName} {s.lastName}</td><td><a href={`mailto:${s.email}`}>{s.email}</a></td><td>{dateTime(s.joinedAt)}</td><td><button type="button" className="magazine-list-delete" disabled={busy} onClick={() => remove(s)}>Delete</button></td></tr>)}</tbody></table></div>
      <form className="magazine-list-composer" onSubmit={prepare}><h2>Email subscribers</h2><p>{selected.length} selected. Each person receives an individual email with their first name and an unsubscribe link.</p>
        {!data.emailConfigured && <p className="magazine-list-error" role="status">Email is not configured on the server. You can prepare a draft; SMTP settings are required before sending.</p>}
        <fieldset disabled={busy}><legend className="sr-only">Compose magazine announcement</legend><label>Subject<input value={subject} maxLength={200} required onChange={(e) => { setSubject(e.target.value); setPreview(null); }} /></label><label>Message<textarea value={message} rows={10} maxLength={10000} required onChange={(e) => { setMessage(e.target.value); setPreview(null); }} /></label><button className="button button--gold" disabled={!selected.length} type="submit">Preview email</button></fieldset>
      </form>
      {preview && <section className="magazine-list-preview" aria-label="Email preview"><h2>Review before sending</h2><p><strong>Subject:</strong> {preview.subject}</p><details><summary>{preview.recipients.length} recipients</summary><ul>{preview.recipients.map((s) => <li key={s.id}>{s.firstName} {s.lastName} — {s.email}</li>)}</ul></details><div className="magazine-list-message">Hi {preview.recipients[0].firstName},{"\n\n"}{preview.message}{"\n\n"}The Collective Magazine{"\n"}Ladies On The Green</div><p>An unsubscribe link is added automatically to each individual email.</p><button className="button button--gold" type="button" disabled={busy || sending || !data.emailConfigured} onClick={send}>{busy ? "Please wait…" : `Send to ${preview.recipients.length} subscriber(s)`}</button>{sending && <p role="status">A previous batch is still sending. Wait for it to finish.</p>}</section>}
      <h2>Send history</h2>{!data.mailings?.length && <p>No emails sent yet.</p>}{data.mailings?.map((m) => <details className="magazine-list-history" key={m.id}><summary>{m.subject} — {m.status} · {dateTime(m.createdAt)}</summary><p>{m.recipients.filter((r) => r.status === "sent").length} sent · {m.recipients.filter((r) => r.status === "failed").length} failed · {m.recipients.filter((r) => r.status === "skipped").length} skipped · {m.recipients.filter((r) => r.status === "pending").length} pending</p>{m.status === "interrupted" && <p>Sending was interrupted. Review counts before sending another batch; pending recipients may have an unknown delivery result.</p>}<div className="magazine-list-message">{m.message}</div><ul>{m.recipients.filter((r) => r.status === "failed").map((r) => <li key={r.id}>Failed: {data.subscribers.find((s) => s.id === r.id)?.email || "Removed subscriber"}</li>)}</ul></details>)}
    </>}
  </section>;
}
