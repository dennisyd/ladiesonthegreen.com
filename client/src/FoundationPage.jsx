import React, { useEffect, useState } from "react";
import { NavLinks } from "./SiteChrome.jsx";
export default function FoundationPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    document.title = "Secure the Bag Foundation | Ladies on the Green®";
  }, []);

  return (
    <>
      <header className="site-header" aria-label="Primary navigation">
        <a className="brand" href="/" aria-label="Ladies On The Green home">
          <img src="/ladiesonthegreen.png?v=2" alt="" />
        </a>
        <span aria-hidden="true" />
        <button
          className="menu-toggle"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="foundation-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? "Close" : "Menu"}
        </button>
        <nav id="foundation-navigation" className={menuOpen ? "is-open" : ""}>
          <NavLinks currentPath="/foundation" />
        </nav>
        <div className="header-actions">
          <a className="header-cta" href="/join">Become A Member ↘</a>
        </div>
      </header>

      <main className="foundation-page" id="top">
        <section className="foundation-hero" aria-labelledby="foundation-title">
          <img
            className="foundation-hero__image"
            src="/foundation-hero-v2.png"
            alt="Women and children learning to putt together on a golf course with an instructor"
          />
          <div className="foundation-hero__shade" aria-hidden="true" />
          <div className="foundation-hero__content">
            <span className="foundation-eyebrow">In partnership with Ladies on the Green®</span>
            <h1 id="foundation-title">Secure the Bag Foundation</h1>
            <p>One child at a time. One opportunity at a time. One future transformed.</p>
          </div>
        </section>

        <section className="foundation-mission" aria-labelledby="foundation-mission-title">
          <div className="foundation-mission__label">
            <span className="section-kicker">Our Mission</span>
            <h2 id="foundation-mission-title">Opening doors through golf</h2>
            <span className="foundation-mission__rule" aria-hidden="true" />
          </div>
          <div className="foundation-mission__copy">
            <p>
              The mission of Secure the Bag Foundation, in partnership with Ladies on the Green®, is to empower the next generation by opening doors through golf, education, financial literacy, and opportunity.
            </p>
            <p>
              We are committed to introducing young people to the game of golf, expanding access to experiences they may not otherwise have, and nurturing confidence, leadership, and essential life skills.
            </p>
            <p>
              By breaking barriers and changing the narrative of who belongs in golf, we strive to inspire young people to dream bigger, explore new possibilities, and build brighter futures.
            </p>
          </div>
        </section>

        <section className="foundation-closing" aria-label="Foundation commitment">
          <p>One child at a time.<br />One opportunity at a time.<br /><em>One future transformed.</em></p>
        </section>
      </main>

      <footer className="site-footer">
        <div>
          <img src="/ladiesonthegreen.png?v=2" alt="" />
          <p>&copy; {new Date().getFullYear()} Ladies On The Green. Golf &amp; Social Club.</p>
        </div>
        <div className="footer-links">
          <a href="/foundation" aria-current="page">Foundation</a>
          <a href="mailto:hello@ladiesonthegreen.com">hello@ladiesonthegreen.com</a>
          <a href="/">Home</a>
        </div>
      </footer>
    </>
  );
}
