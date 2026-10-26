import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./api.js";
import { OTHER, QUESTIONNAIRE, otherKey } from "../../shared/questionnaire.js";

// /admin → Questionnaire: everyone who filled in the Connect page questionnaire.

const SORTS = {
  newest: ["Newest first", (a, b) => b.submittedAt.localeCompare(a.submittedAt)],
  oldest: ["Oldest first", (a, b) => a.submittedAt.localeCompare(b.submittedAt)],
  name: ["Name (A–Z)", (a, b) => fullName(a).localeCompare(fullName(b))],
  state: ["State (A–Z)", (a, b) => (a.answers.state || "~").localeCompare(b.answers.state || "~") || (a.answers.city || "").localeCompare(b.answers.city || "")]
};

const fullName = (r) => `${r.answers.firstName || ""} ${r.answers.lastName || ""}`.trim();
const location = (r) => [r.answers.city, r.answers.state].filter(Boolean).join(", ");

function answerText(question, answers) {
  const value = answers[question.id];
  if (!value || (Array.isArray(value) && !value.length)) return "";
  return (Array.isArray(value) ? value : [value]).map((v) => (v === OTHER ? `Other: ${answers[otherKey(question.id)]}` : v)).join("; ");
}

const when = (iso) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

const unique = (list) => [...new Set(list.filter(Boolean))].sort();

export default function QuestionnaireAdmin() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [state, setState] = useState("");
  const [relationship, setRelationship] = useState("");
  const [updates, setUpdates] = useState("");
  const [sort, setSort] = useState("newest");
  const [openId, setOpenId] = useState(null);

  const load = useCallback(() => {
    api("/api/admin/questionnaire").then(
      (result) => setData(result.responses),
      (err) => setError(err.message)
    );
  }, []);
  useEffect(load, [load]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data || [])
      .filter((r) => {
        const a = r.answers;
        if (state && a.state !== state) return false;
        if (relationship && a.relationship !== relationship) return false;
        if (updates === "yes" && a.updates !== "Yes, please keep me informed") return false;
        if (updates === "no" && a.updates !== "No, thank you") return false;
        if (!q) return true;
        const text = QUESTIONNAIRE.sections.flatMap((s) => s.questions).map((qq) => answerText(qq, a)).join(" ");
        return text.toLowerCase().includes(q);
      })
      .sort(SORTS[sort][1]);
  }, [data, query, state, relationship, updates, sort]);

  async function remove(r) {
    if (!window.confirm(`Delete ${fullName(r) || "this response"}'s questionnaire permanently? This can't be undone.`)) return;
    try {
      await api(`/api/admin/questionnaire/${r.id}`, { method: "DELETE" });
      setOpenId(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!data) return <p className={`form-status ${error ? "form-status--error" : "form-status--success"}`}>{error || "Loading responses..."}</p>;

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const states = unique(data.map((r) => r.answers.state));
  const relationships = unique(data.map((r) => r.answers.relationship));
  const stat = (label, value) => (
    <div className="admin-stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );

  return (
    <section>
      <div className="admin-section-head">
        <div>
          <h2>Questionnaire</h2>
          <p>Answers from the questionnaire on the Connect page. Each one is also emailed to you when it arrives.</p>
        </div>
      </div>

      <div className="admin-stats">
        {stat("Responses", data.length)}
        {stat("In the last 7 days", data.filter((r) => r.submittedAt >= weekAgo).length)}
        {stat("Paid members", data.filter((r) => r.answers.relationship === "I am a paid member").length)}
        {stat("Want updates", data.filter((r) => r.answers.updates === "Yes, please keep me informed").length)}
      </div>

      <div className="admin-toolbar qn-admin-toolbar">
        <input type="search" placeholder="Search any answer, name or email" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select value={state} onChange={(e) => setState(e.target.value)} aria-label="Filter by state">
          <option value="">All states</option>
          {states.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select value={relationship} onChange={(e) => setRelationship(e.target.value)} aria-label="Filter by relationship">
          <option value="">Everyone</option>
          {relationships.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select value={updates} onChange={(e) => setUpdates(e.target.value)} aria-label="Filter by updates">
          <option value="">Updates: any</option>
          <option value="yes">Wants updates</option>
          <option value="no">No updates</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort by">
          {Object.entries(SORTS).map(([key, [label]]) => <option key={key} value={key}>{label}</option>)}
        </select>
        <a className="button button--outline" href="/api/admin/questionnaire.csv">Export CSV</a>
      </div>
      <p className="admin-sub">Showing {rows.length} of {data.length}. The CSV always contains every response.</p>
      {error && <p className="form-status form-status--error" role="alert">{error}</p>}

      {rows.length === 0 ? (
        <p className="admin-empty">{data.length === 0 ? "No responses yet. They appear here as people fill in the questionnaire." : "No responses match."}</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Submitted</th>
                <th>Name</th>
                <th>Location</th>
                <th>Relationship</th>
                <th>Years playing</th>
                <th aria-label="Details" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <React.Fragment key={r.id}>
                  <tr>
                    <td>{when(r.submittedAt)}</td>
                    <td>
                      <strong>{fullName(r) || "(no name)"}</strong>
                      <span className="admin-sub">{r.answers.email}</span>
                    </td>
                    <td>{location(r) || "—"}</td>
                    <td>{r.answers.relationship || "—"}</td>
                    <td>{r.answers.yearsPlayed || "—"}</td>
                    <td>
                      <div className="admin-actions">
                        <button type="button" className="admin-link" onClick={() => setOpenId(openId === r.id ? null : r.id)}>
                          {openId === r.id ? "Close" : "All answers"}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {openId === r.id && (
                    <tr className="admin-detail-row">
                      <td colSpan={6}>
                        <div className="qn-admin-detail">
                          {QUESTIONNAIRE.sections.map((section) => {
                            const items = section.questions.map((q) => [q, answerText(q, r.answers)]).filter(([, text]) => text);
                            if (!items.length) return null;
                            return (
                              <div key={section.title}>
                                <h4>{section.title}</h4>
                                <dl>
                                  {items.map(([q, text]) => (
                                    <React.Fragment key={q.id}>
                                      <dt>{q.label}</dt>
                                      <dd>{text}</dd>
                                    </React.Fragment>
                                  ))}
                                </dl>
                              </div>
                            );
                          })}
                          <div className="admin-actions">
                            <a className="admin-link" href={`mailto:${r.answers.email}`}>Email {r.answers.firstName}</a>
                            <button type="button" className="admin-link admin-link--danger" onClick={() => remove(r)}>Delete response</button>
                          </div>
                        </div>
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
