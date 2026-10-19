import React, { useState } from "react";
import { navItems } from "./siteNav.js";

// Header and footer for the simple content pages (About Us, Girls on the Green).
// `currentPath` marks that page's link in the menu.

export function SiteHeader({ currentPath }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="site-header" aria-label="Primary navigation">
      <a className="brand" href="/" aria-label="Ladies On The Green home">
        <img src="/ladiesonthegreen.png?v=2" alt="" />
      </a>
      <span aria-hidden="true" />
      <button
        className="menu-toggle"
        type="button"
        aria-expanded={menuOpen}
        aria-controls="site-navigation"
        onClick={() => setMenuOpen((open) => !open)}
      >
        {menuOpen ? "Close" : "Menu"}
      </button>
      <nav id="site-navigation" className={menuOpen ? "is-open" : ""}>
        {navItems.map((item) => (
          <a href={item.href} key={item.href} aria-current={item.href === currentPath ? "page" : undefined}>
            {item.label}
          </a>
        ))}
      </nav>
      <div className="header-actions">
        <a className="header-cta" href="/join">Become A Member ↘</a>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div>
        <img src="/ladiesonthegreen.png?v=2" alt="" />
        <p>&copy; {new Date().getFullYear()} Ladies On The Green. Golf &amp; Social Club.</p>
      </div>
      <div className="footer-links">
        <a href="/foundation">Foundation</a>
        <a href="mailto:hello@ladiesonthegreen.com">hello@ladiesonthegreen.com</a>
        <a href="/">Home</a>
      </div>
    </footer>
  );
}
