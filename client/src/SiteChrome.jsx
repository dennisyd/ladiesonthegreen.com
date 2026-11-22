import React, { useEffect, useRef, useState } from "react";
import { navItems } from "./siteNav.js";

// Header and footer for the simple content pages (About Us, Young Ladies on the Green).
// `currentPath` marks that page's link in the menu.

// The menu links, with dropdowns for items that have `children`. `currentPath` marks the
// page you are on; `onNavigate` lets a page close its mobile menu after a click.
export function NavLinks({ items = navItems, currentPath, onNavigate }) {
  const [openLabel, setOpenLabel] = useState(null);
  return items.map((item) =>
    item.children ? (
      <div
        className={`nav-drop${openLabel === item.label ? " is-open" : ""}`}
        key={item.label}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setOpenLabel(null);
        }}
      >
        <button
          type="button"
          className="nav-drop__toggle"
          aria-haspopup="true"
          aria-expanded={openLabel === item.label}
          aria-current={item.children.some((c) => c.href === currentPath) ? "page" : undefined}
          onClick={() => setOpenLabel(openLabel === item.label ? null : item.label)}
        >
          {item.label} <span aria-hidden="true">▾</span>
        </button>
        <div className="nav-drop__menu">
          {item.children.map((child) => (
            <a
              href={child.href}
              key={child.href}
              aria-current={child.href === currentPath ? "page" : undefined}
              onClick={onNavigate}
            >
              {child.label}
            </a>
          ))}
        </div>
      </div>
    ) : (
      <a href={item.href} key={item.href} aria-current={item.href === currentPath ? "page" : undefined} onClick={onNavigate}>
        {item.label}
      </a>
    )
  );
}

export function SiteHeader({ currentPath, autoHide = false }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const headerRef = useRef(null);

  useEffect(() => {
    if (!autoHide) return;
    let lastY = window.scrollY;
    let travel = 0;
    function onScroll() {
      const y = window.scrollY;
      const delta = y - lastY;
      lastY = y;
      if (y < 80 || menuOpen || headerRef.current?.contains(document.activeElement)) {
        travel = 0;
        setHidden(false);
        return;
      }
      if (Math.abs(delta) < 2) return;
      if (Math.sign(delta) !== Math.sign(travel)) travel = 0;
      travel += delta;
      if (travel > 28 && y > (headerRef.current?.offsetHeight || 128) + 20) {
        setHidden(true);
        travel = 0;
      } else if (travel < -18) {
        setHidden(false);
        travel = 0;
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [autoHide, menuOpen]);

  return (
    <header ref={headerRef} className={`site-header${autoHide ? " site-header--auto-hide" : ""}${hidden ? " site-header--hidden" : ""}`} aria-label="Primary navigation" onFocusCapture={() => setHidden(false)}>
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
        <NavLinks currentPath={currentPath} />
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
