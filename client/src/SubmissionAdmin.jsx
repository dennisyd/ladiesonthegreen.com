import React, { useEffect, useState } from "react";
import { api } from "./api.js";
import "./submission.css";

const receivedTime = (value) => new Date(value).toLocaleString("en-US", {
  timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric",
  hour: "numeric", minute: "2-digit", timeZoneName: "short"
});

export default function SubmissionAdmin() {
  const [items, setItems] = useState(null), [error, setError] = useState("");
  const [busy, setBusy] = useState(null);
  useEffect(() => { api("/api/admin/submissions").then((data) => setItems(data.submissions)).catch((err) => setError(err.message)); }, []);
  async function changeStatus(id, status) {
    setBusy(id); setError("");
    try { await api(`/api/admin/submissions/${id}`, { method: "PATCH", body: { status } }); setItems((current) => current.map((s) => s.id === id ? { ...s, status } : s)); }
    catch (err) { setError(err.message); }
    finally { setBusy(null); }
  }
  async function removeSubmission(submission) {
    if (!window.confirm(`Delete “${submission.title}” by ${submission.firstName} ${submission.lastName}? This permanently removes the article, uploaded document, photos, and portrait and cannot be undone.`)) return;
    setBusy(submission.id); setError("");
    try {
      await api(`/api/admin/submissions/${submission.id}`, { method: "DELETE" });
      setItems((current) => current.filter((s) => s.id !== submission.id));
    } catch (err) { setError(err.message); }
    finally { setBusy(null); }
  }
  return <section><h1>Magazine submissions</h1><p>Review contributor articles and photos. Status changes are internal; they do not publish an article or send an email.</p><a href="/submission" target="_blank" rel="noreferrer">Open submission page ↗</a>
    {error && <p role="alert">{error}</p>}{!items && !error && <p role="status">Loading submissions…</p>}{items?.length === 0 && <p>No submissions yet.</p>}
    {items?.map((s) => <details className="submission-review" key={s.id}><summary>{s.title} — {s.firstName} {s.lastName} · {s.status}<time className="submission-review__time" dateTime={s.receivedAt}>{receivedTime(s.receivedAt)}</time></summary><div className="submission-review__meta"><a href={`mailto:${s.email}`}>{s.email}</a><br />{s.city}, {s.state}{s.profession && <><br />Profession, Business, or Passion: {s.profession}</>}<br />Received {receivedTime(s.receivedAt)}<br />High-resolution photos available: {s.photosAvailable ? "Yes" : "Not indicated"}<br />Review/contact permission: {s.permission?.granted ? `Granted ${receivedTime(s.permission.grantedAt)}` : "Not recorded (earlier submission)"}</div><label>Review status<select aria-label={`Status for ${s.title}`} value={s.status} disabled={busy === s.id} onChange={(e) => changeStatus(s.id, e.target.value)}>{["new", "reviewed", "selected", "declined"].map((status) => <option key={status} value={status}>{status}</option>)}</select></label><button type="button" className="submission-review__delete" disabled={busy === s.id} onClick={() => removeSubmission(s)}>{busy === s.id ? "Please wait…" : "Delete submission"}</button>{s.article && <div className="submission-review__article">{s.article}</div>}{s.document && <p><a className="button button--secondary" href={`/api/admin/submissions/${s.id}/document`}>Download article: {s.document.name}</a></p>}<div className="submission-review__images">{[...(s.portrait ? [{ ...s.portrait, caption: "Contributor portrait" }] : []), ...s.photos.map((p, i) => ({ ...p, caption: `Article photo ${i + 1}` }))].map((p) => <figure key={p.filename}><a href={`/api/admin/submissions/${s.id}/images/${p.filename}`} target="_blank" rel="noreferrer">{/\.heic$/i.test(p.filename) ? <div className="submission-heic-preview">HEIC photo · Download to view</div> : <img loading="lazy" src={`/api/admin/submissions/${s.id}/images/${p.filename}`} alt={p.caption} />}</a><figcaption>{p.caption} · <a href={`/api/admin/submissions/${s.id}/images/${p.filename}`} download={p.name}>Download</a></figcaption></figure>)}</div></details>)}
  </section>;
}
