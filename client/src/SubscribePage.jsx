import React, { useEffect, useRef, useState } from "react";
import { SiteHeader, SiteFooter } from "./SiteChrome.jsx";
import { api } from "./api.js";
import "./subscribe.css";

export default function SubscribePage() {
  const [status, setStatus] = useState(""), [message, setMessage] = useState("");
  const success = useRef(null);
  useEffect(() => { document.title = "Join the List | The Collective Magazine"; }, []);
  useEffect(() => { if (status === "success") success.current?.focus(); }, [status]);
  async function join(event) {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget));
    setStatus("sending"); setMessage("");
    try { const data = await api("/api/magazine-list", { method: "POST", body }); setMessage(data.message); setStatus("success"); }
    catch (err) { setStatus("error"); setMessage(err.message); }
  }
  const busy = status === "sending";
  return <><SiteHeader currentPath="/subscribe" /><main className="subscribe-page"><section className="subscribe-card" aria-labelledby="subscribe-title">
    <div className="subscribe-ribbon subscribe-ribbon--top" aria-hidden="true" /><div className="subscribe-ribbon subscribe-ribbon--bottom" aria-hidden="true" />
    <div className="subscribe-content"><p className="subscribe-presented"><span>Ladies On The Green<sup>®</sup> Presents</span></p>
      <div className="subscribe-masthead">The Collective</div><div className="subscribe-magazine"><span>Magazine</span></div>
      <p className="subscribe-tagline">The Woman Next Door. The Golfer Next Door.</p>
      <h1 id="subscribe-title">Be Among the First to Read</h1><div className="subscribe-swoosh" aria-hidden="true" />
      <p className="subscribe-description">Our inaugural issue is coming! Discover inspiring stories, golf, fashion, travel, wellness, business, and the women who connect us.</p>
      <div className="subscribe-price"><strong>$19.99<span> / year</span></strong><span>Four Quarterly Digital Issues</span></div>
      <h2 className="subscribe-reserve">Reserve your interest today.<br />No payment required.</h2><div className="subscribe-swoosh subscribe-swoosh--short" aria-hidden="true" />
      {status === "success" ? <div className="subscribe-success" ref={success} tabIndex={-1} role="status"><h2>You’re on the list!</h2><p>{message}</p><a href="/magazine">Back to the magazine ↗</a></div>
      : <form className="subscribe-form" onSubmit={join} aria-busy={busy}><fieldset disabled={busy}><legend className="sr-only">Join The Collective Magazine list</legend>
        <div className="subscribe-name-fields"><label><span className="sr-only">First Name</span><input name="firstName" autoComplete="given-name" placeholder="First Name" maxLength={80} required /></label><label><span className="sr-only">Last Name</span><input name="lastName" autoComplete="family-name" placeholder="Last Name" maxLength={80} required /></label></div>
        <label><span className="sr-only">Email Address</span><input name="email" type="email" autoComplete="email" placeholder="Email Address" maxLength={254} required /></label>
        <label className="subscribe-trap" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
        <button className="subscribe-join" type="submit">{busy ? "JOINING…" : "JOIN THE LIST"}</button>
      </fieldset>{status === "error" && <p className="subscribe-error" role="alert">{message}</p>}</form>}
      <p className="subscribe-reassurance"><svg aria-hidden="true" viewBox="0 0 24 28" width="30" height="36"><path d="M6 12V8a6 6 0 0 1 12 0v4" fill="none" stroke="currentColor" strokeWidth="3" /><rect x="2" y="11" width="20" height="16" rx="3" fill="currentColor" /><circle cx="12" cy="18" r="2" fill="#fffefa" /><path d="M12 19v3" stroke="#fffefa" strokeWidth="2" /></svg><span>You will not be charged. No payment information is required.</span></p>
      <p className="subscribe-privacy">Join the list for magazine launch and subscription updates.</p>
    </div>
  </section></main><SiteFooter /></>;
}
