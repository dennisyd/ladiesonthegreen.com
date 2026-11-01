import React, { useEffect } from "react";
import { SiteHeader, SiteFooter } from "./SiteChrome.jsx";
import "./subscribe.css";

export default function SubscribePage() {
  useEffect(() => { document.title = "Subscribe to The Collective | Ladies On The Green"; }, []);
  return <><SiteHeader currentPath="/subscribe" /><main className="subscribe-page">
    <section className="subscribe-card" aria-labelledby="subscribe-title">
      <span className="subscribe-kicker">The Collective Magazine</span>
      <div className="subscribe-mark" aria-hidden="true">C<span>THE COLLECTIVE</span></div>
      <p className="subscribe-announcement">A new chapter is on its way.</p>
      <h1 id="subscribe-title">Subscriptions<br /><em>opening soon.</em></h1>
      <p className="subscribe-intro">Real women. Real stories. A little inspiration for life on and beyond the fairway.</p>
      <p>We’re preparing something special for the woman next door. Magazine subscription details will be shared here when they’re ready.</p>
      <div className="subscribe-rule" aria-hidden="true" />
      <h2>In the meantime, your story belongs here.</h2>
      <p>Have a journey, a lesson, or a moment worth sharing? We’d love to hear it.</p>
      <div className="subscribe-actions"><a className="button subscribe-story" href="/submission">Submit Your Story ↗</a><a className="subscribe-back" href="/magazine">Back to the magazine</a></div>
      <p className="subscribe-signoff">Her Story. Our Collective.</p>
    </section>
  </main><SiteFooter /></>;
}
