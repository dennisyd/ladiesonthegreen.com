import React, { useCallback, useEffect, useState } from "react";
import { api } from "./api.js";

const when = (value) => value ? new Date(value).toLocaleDateString("en-US", {
  month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York"
}) : "";

function ReplacePage({ issue, disabled, setBusy, setError, setNotice, reload }) {
  const [page, setPage] = useState("");
  const [file, setFile] = useState(null);

  async function submit(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    if (!file) return setError("Choose the new page (PDF, PNG or JPG).");
    const live = issue.status === "published";
    const warning = live ? " This issue is live, so members will see the change immediately." : "";
    if (!window.confirm(`Replace page ${page} of “${issue.title}” with ${file.name}?${warning} The previous version is kept.`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const form = new FormData();
      form.set("page", String(page));
      form.set("file", file);
      const response = await fetch(`/api/admin/magazine-issues/${issue.id}/replace-page`, {
        method: "POST", body: form, credentials: "same-origin"
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "The page could not be replaced.");
      setNotice(`Page ${data.page} of ${data.pageCount} in “${issue.title}” was replaced${data.fit === "scaled-to-fit" ? " (the new page was a different shape, so it was scaled to fit)" : ""}. Preview the PDF to check it.`);
      setPage(""); setFile(null);
      formElement.reset();
      await reload();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return (
    <details className="magazine-issues-admin__replace">
      <summary className="admin-link">Replace a page</summary>
      <form onSubmit={submit}>
        <label>Page number to replace
          <input type="number" min="1" step="1" value={page} onChange={(event) => setPage(event.target.value)} required />
        </label>
        <label>New page (PDF, PNG or JPG, up to 25 MB)
          <input type="file" accept="application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg" onChange={(event) => setFile(event.target.files?.[0] || null)} required />
        </label>
        <p className="admin-sub">The page is used exactly as you send it, scaled to fit. Its printed page number is not changed, so make sure it already shows the right number.</p>
        <button className="button button--gold" type="submit" disabled={disabled}>Replace page</button>
      </form>
    </details>
  );
}

export default function MagazineIssuesAdmin() {
  const [issues, setIssues] = useState(null);
  const [title, setTitle] = useState("");
  const [edition, setEdition] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const reload = useCallback(async () => {
    const data = await api("/api/admin/magazine-issues");
    setIssues(data.issues);
  }, []);
  useEffect(() => { reload().catch((err) => setError(err.message)); }, [reload]);

  async function upload(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    if (!file || !file.name.toLowerCase().endsWith(".pdf")) return setError("Choose a PDF file.");
    setBusy(true); setError(""); setNotice("");
    try {
      const form = new FormData();
      form.set("title", title.trim());
      form.set("edition", edition.trim());
      form.set("file", file);
      const response = await fetch("/api/admin/magazine-issues", {
        method: "POST", body: form, credentials: "same-origin"
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "The PDF could not be uploaded.");
      setNotice(`“${data.issue.title}” was saved as a draft. Preview it, then publish when it is final.`);
      setTitle(""); setEdition(""); setFile(null);
      formElement.reset();
      await reload();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function changeStatus(issue, action) {
    const next = action === "publish" ? "publish this issue to members" : "archive this issue";
    if (!window.confirm(`Are you ready to ${next}?${action === "publish" ? " The current issue will move to the archive." : " Members will still find it in past editions."}`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await api(`/api/admin/magazine-issues/${issue.id}/${action}`, { method: "POST" });
      setNotice(action === "publish" ? `“${issue.title}” is now the current issue.` : `“${issue.title}” is archived.`);
      await reload();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  const current = issues?.find((issue) => issue.status === "published");
  return (
    <section className="magazine-issues-admin">
      <div className="admin-section-head">
        <div>
          <h2>Magazine issues</h2>
          <p>Upload a final PDF as a draft, preview it, then publish it for members. Publishing a new issue moves the current one to Past editions automatically.</p>
        </div>
        <a className="button button--outline" href="/thecollective" target="_blank" rel="noopener noreferrer">View magazine ↗</a>
      </div>
      {error && <p className="form-status form-status--error" role="alert">{error}</p>}
      {notice && <p className="form-status form-status--success" role="status">{notice}</p>}

      <div className="magazine-issues-admin__layout">
        <form className="admin-card" onSubmit={upload}>
          <span className="section-kicker">New edition</span>
          <h3>Upload a PDF</h3>
          <label>Issue title
            <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder="The Collective — Spring 2027" required />
          </label>
          <label>Edition or season (optional)
            <input value={edition} onChange={(event) => setEdition(event.target.value)} maxLength={80} placeholder="Spring 2027 · Issue 02" />
          </label>
          <label>PDF file
            <input type="file" accept="application/pdf,.pdf" onChange={(event) => setFile(event.target.files?.[0] || null)} required />
          </label>
          <p className="admin-sub">PDF, up to 80 MB. Uploading saves a private draft and does not publish it.</p>
          <button className="button button--gold" type="submit" disabled={busy}>{busy ? "Working..." : "Upload draft"}</button>
        </form>
        <div className="magazine-issues-admin__current">
          <span className="section-kicker">On the magazine page</span>
          <h3>{current ? current.title : "Coming soon"}</h3>
          <p>{current ? `${current.edition ? `${current.edition} · ` : ""}Published ${when(current.publishedAt)}` : "Members will see the magazine welcome page until you publish an issue."}</p>
          {current && <a className="admin-link" href={current.previewUrl} target="_blank" rel="noopener noreferrer">Preview current PDF ↗</a>}
        </div>
      </div>

      <div className="admin-group magazine-issues-admin__list">
        <h3>All editions <span>{issues?.length || 0}</span></h3>
        {issues === null ? <p>Loading issues...</p> : issues.length === 0 ? <p className="admin-empty">No issue has been uploaded yet.</p> : (
          <div className="magazine-issues-admin__cards">
            {issues.map((issue) => (
              <article className="magazine-issues-admin__item" key={issue.id}>
                <span className={`magazine-issues-admin__status magazine-issues-admin__status--${issue.status}`}>{issue.status === "published" ? "Current" : issue.status}</span>
                <h4>{issue.title}</h4>
                {issue.edition && <p>{issue.edition}</p>}
                <small>{issue.originalName} · Uploaded {when(issue.uploadedAt)}</small>
                <div className="admin-actions">
                  <a className="admin-link" href={issue.previewUrl} target="_blank" rel="noopener noreferrer">Preview PDF ↗</a>
                  {issue.status !== "published" && <button className="admin-link" type="button" disabled={busy} onClick={() => changeStatus(issue, "publish")}>Publish</button>}
                  {issue.status === "published" && <button className="admin-link" type="button" disabled={busy} onClick={() => changeStatus(issue, "archive")}>Archive</button>}
                </div>
                <ReplacePage issue={issue} disabled={busy} setBusy={setBusy} setError={setError} setNotice={setNotice} reload={reload} />
                {issue.pageEdits?.length > 0 && <small>Last page change: page {issue.pageEdits.at(-1).page}, {when(issue.pageEdits.at(-1).at)}</small>}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
