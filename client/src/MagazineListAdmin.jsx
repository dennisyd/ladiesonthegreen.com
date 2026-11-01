import React, { useEffect, useState } from "react";
import { api } from "./api.js";

export default function MagazineListAdmin() {
  const [subscribers, setSubscribers] = useState(null), [error, setError] = useState("");
  useEffect(() => { api("/api/admin/magazine-list").then((data) => setSubscribers(data.subscribers)).catch((err) => setError(err.message)); }, []);
  return <section><h1>Magazine interest list</h1><p>People who joined the list for The Collective launch and subscription updates. These are expressions of interest; no payment has been collected.</p><a href="/subscribe" target="_blank" rel="noreferrer">Open subscription page ↗</a>
    {error && <p role="alert">{error}</p>}{subscribers === null && !error && <p role="status">Loading the list…</p>}
    {subscribers && <><h2>{subscribers.length} {subscribers.length === 1 ? "person" : "people"} on the list</h2><div style={{ overflowX: "auto" }}><table className="admin-table"><thead><tr><th scope="col">First name</th><th scope="col">Last name</th><th scope="col">Email</th><th scope="col">Joined (Eastern Time)</th></tr></thead><tbody>{subscribers.map((s) => <tr key={s.id}><td>{s.firstName}</td><td>{s.lastName}</td><td><a href={`mailto:${s.email}`}>{s.email}</a></td><td>{new Date(s.joinedAt).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" })}</td></tr>)}</tbody></table></div></>}
  </section>;
}
