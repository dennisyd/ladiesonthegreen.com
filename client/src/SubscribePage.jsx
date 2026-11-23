import React, { useEffect, useState } from "react";
import { SiteHeader, SiteFooter } from "./SiteChrome.jsx";
import { api } from "./api.js";
import "./subscribe.css";

export default function PaidMagazineSubscription() {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [subscriber, setSubscriber] = useState(null), [challengeId, setChallengeId] = useState("");
  useEffect(() => {
    document.title = "Subscribe | The Collective Magazine";
    const checkoutId = new URLSearchParams(window.location.search).get("checkout");
    if (checkoutId) {
      setBusy(true);
      api("/api/magazine-subscription/confirm", { method: "POST", body: { checkoutId } })
        .then((data) => { setSubscriber(data); window.history.replaceState(null, "", "/subscribe"); })
        .catch((error) => setMessage(error.message)).finally(() => setBusy(false));
    } else api("/api/magazine-subscription/me").then(setSubscriber).catch(() => {});
  }, []);
  useEffect(() => {
    if (subscriber?.access !== "waiting") return;
    const timer = setInterval(() => api("/api/magazine-subscription/me").then(setSubscriber).catch(() => {}), 60000);
    return () => clearInterval(timer);
  }, [subscriber?.access]);
  async function submit(event, action) {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget));
    if (action === "verify") body.challengeId = challengeId;
    setBusy(true); setMessage("");
    try {
      const data = await api(`/api/magazine-subscription/${action}`, { method: "POST", body });
      if (data.url) window.location.assign(data.url);
      else if (data.challengeId) { setChallengeId(data.challengeId); setMessage(data.message); }
      else setSubscriber(data);
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  return <><SiteHeader currentPath="/subscribe" /><main className="subscribe-page"><section className="subscribe-card" aria-labelledby="subscribe-title">
    <div className="subscribe-ribbon subscribe-ribbon--top" aria-hidden="true" /><div className="subscribe-ribbon subscribe-ribbon--bottom" aria-hidden="true" />
    <div className="subscribe-content"><p className="subscribe-presented">Ladies On The Green® Presents</p>
      <div className="subscribe-masthead">The Collective</div><div className="subscribe-magazine"><span>Magazine</span></div>
      <p className="subscribe-tagline">The Woman Next Door. The Golfer Next Door.</p>
      <h1 id="subscribe-title">Subscribe to The Collective</h1><div className="subscribe-swoosh" aria-hidden="true" />
      <p className="subscribe-description">Our magazine is here! Discover inspiring stories, golf, fashion, travel, wellness, business, and the women who connect us.</p>
      <div className="subscribe-price"><strong>$19.99<span> / year</span></strong><span>Three Digital Issues Per Year<br />Fall/Winter, Spring, and Summer</span></div>
      <p className="subscribe-reserve">Digital access begins one hour after successful payment.</p>
      {subscriber ? <div className="subscribe-success" role="status">
        <h2>{subscriber.access === "ready" ? "Your magazine is ready" : subscriber.access === "waiting" ? "Thank you for subscribing!" : "Your subscription is inactive"}</h2>
        {subscriber.access === "waiting" && <p>Your access begins {new Date(subscriber.availableAt).toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" })}. Return here after that time to read.</p>}
        {subscriber.access === "ready" && <a className="button button--gold" href="/thecollective">Read the magazine ↗</a>}
        <form onSubmit={(event) => submit(event, "billing")}><button className="subscribe-join" disabled={busy}>Manage subscription</button></form>
      </div> : <>
        <form className="subscribe-form" onSubmit={(event) => submit(event, "checkout")} aria-busy={busy}><fieldset disabled={busy}><legend className="sr-only">Purchase an annual magazine subscription</legend>
          <label><span className="sr-only">Email Address</span><input name="email" type="email" autoComplete="email" placeholder="Your email address" maxLength={254} required /></label>
          <p>Renews annually at $19.99 until canceled. Cancel through Manage subscription. Use this email to sign in after checkout.</p>
          <button className="subscribe-join" type="submit">{busy ? "PLEASE WAIT…" : "SUBSCRIBE — $19.99 / YEAR"}</button>
        </fieldset></form>
        <h2>Already subscribed?</h2>
        <form className="subscribe-form" onSubmit={(event) => submit(event, challengeId ? "verify" : "login")}><fieldset disabled={busy}>
          <legend className="sr-only">Magazine subscriber sign-in</legend>
          {challengeId ? <label>Sign-in code<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required /></label>
            : <label>Checkout email<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>}
          <button className="subscribe-join" type="submit">{challengeId ? "SIGN IN" : "EMAIL ME A SIGN-IN CODE"}</button>
          {challengeId && <button type="button" onClick={() => { setChallengeId(""); setMessage(""); }}>Request a new code</button>}
        </fieldset></form>
      </>}
      {message && <p role="status">{message}</p>}
      <p className="subscribe-reassurance">Secure payment through Stripe. Your one-hour waiting period starts after payment succeeds.</p>
      <p className="subscribe-privacy">Club member? Your membership includes digital access. <a href="/members">Sign in here ↗</a></p>
    </div></section></main><SiteFooter /></>;
}
