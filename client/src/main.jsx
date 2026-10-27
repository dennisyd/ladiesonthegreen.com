import React, { Suspense, lazy, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import JoinPage from "./JoinPage.jsx";
import { navItems as siteNavItems } from "./siteNav.js";
import { EventCards, EventsLoading, useSiteEvents } from "./EventsPage.jsx";
import { NavLinks } from "./SiteChrome.jsx";

// Code-split: the flipbook viewer pulls in pdf.js + react-pageflip (~2MB),
// which only the /magazine routes need, so keep them out of every other
// page's bundle.
const MagazinePage = lazy(() => import("./MagazinePage.jsx"));
const MagazineAdminPage = lazy(() => import("./MagazineAdminPage.jsx"));
const AdminPage = lazy(() => import("./AdminPage.jsx"));
const MembersPage = lazy(() => import("./MembersPage.jsx"));
const ShopPage = lazy(() => import("./ShopPage.jsx"));
const AboutPage = lazy(() => import("./AboutPage.jsx"));
const QuestionnairePage = lazy(() => import("./QuestionnairePage.jsx"));
const EventsPage = lazy(() => import("./EventsPage.jsx"));
const GirlsOnTheGreenPage = lazy(() => import("./GirlsOnTheGreenPage.jsx"));
const FoundationPage = lazy(() => import("./FoundationPage.jsx"));
const TestMembershipPage = lazy(() => import("./TestMembershipPage.jsx"));

const facebookUrl = "https://www.facebook.com/groups/2400195883513090";

const heroSlides = [
  { type: "image", src: "/hero-golf-argyle-landscape.png", position: "58% top", alt: "Woman wearing a pink and green Ladies On The Green golf polo on the course" },
  { type: "image", src: "/hero-golf-yellow-landscape.png", position: "64% top", alt: "Woman in yellow beside her golf bag and Ladies On The Green branding" },
  { type: "image", src: "/hero-sunset-friends-landscape.png", position: "50% center", alt: "Three diverse women looking out at the sunset together on the beach" },
  { type: "video", src: "/golf-video.mp4?v=2", alt: "" },
  { type: "video", src: "/collective-experience-2.mp4", alt: "" },
  { type: "image", src: "/hero-4.jpg", alt: "Ladies On The Green members seated together at the clubhouse" }
];

// The shared menu uses site-wide paths; on the home page its items scroll in place.
const navItems = siteNavItems.map((item) =>
  item.href ? { ...item, href: item.href === "/" ? "#top" : item.href.replace(/^\/#/, "#") } : item
);

const benefitTabs = [
  {
    label: "Community",
    title: "Meet women who make golf feel welcoming.",
    points: ["Member intros", "Social rounds", "Group chats", "Partner events"]
  },
  {
    label: "Education",
    title: "Build confidence before, during, and after the round.",
    points: ["Beginner clinics", "Short-game lessons", "Course etiquette", "Equipment guidance"]
  },
  {
    label: "Access",
    title: "Get invited to the moments that make the club feel alive.",
    points: ["Priority event access", "Member tee times", "Guest invites", "Founding member updates"]
  },
  {
    label: "Lifestyle",
    title: "Enjoy the culture around the game, not only the score.",
    points: ["Brunches", "Wellness days", "Brand activations", "Charity outings"]
  }
];

const momentsGallery = [
  { src: "/moments-clubhouse.jpg", alt: "Pine Ridge Golf Course clubhouse at golden hour" },
  { src: "/moments-cart-bags.jpg", alt: "Golf bags loaded onto a cart before a round" },
  { src: "/moments-gps.jpg", alt: "Cart GPS screen showing the yardage for an upcoming hole" },
  { src: "/moments-sunset.jpg", alt: "Sunset over the green at Pine Ridge Golf Course" }
];

const partners = ["Courses", "Clinics", "Brands", "Local Hosts"];

function App() {
  const [formState, setFormState] = useState({ status: "idle", message: "" });
  const [menuOpen, setMenuOpen] = useState(false);
  const siteEvents = useSiteEvents();
  const [activeBenefit, setActiveBenefit] = useState(0);
  const [heroIndex, setHeroIndex] = useState(0);
  const heroVideoRefs = useRef([]);
  const currentBenefit = benefitTabs[activeBenefit];

  useEffect(() => {
    const activeSlide = heroSlides[heroIndex];
    // Video slides advance on their own "ended" event (see below) so they
    // always play in full, however long the clip is.
    if (activeSlide.type === "video") return;
    const timer = setTimeout(() => {
      setHeroIndex((index) => (index + 1) % heroSlides.length);
    }, activeSlide.duration ?? 5000);
    return () => clearTimeout(timer);
  }, [heroIndex]);

  useEffect(() => {
    heroVideoRefs.current.forEach((item, index) => {
      if (item && index !== heroIndex) item.pause();
    });
    const video = heroVideoRefs.current[heroIndex];
    if (!video) return;
    if (heroSlides[heroIndex].type === "video") {
      try {
        video.currentTime = 0;
      } catch {
        // Metadata not loaded yet; play() below will still start from 0.
      }
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [heroIndex]);

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    setFormState({ status: "loading", message: "Sending..." });

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Something went wrong.");
      }

      form.reset();
      setFormState({ status: "success", message: data.message });
    } catch (error) {
      setFormState({
        status: "error",
        message: error.message || "Please try again in a moment."
      });
    }
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <>
      <header className="site-header" aria-label="Primary navigation">
        <a className="brand" href="#top" aria-label="Ladies On The Green home" onClick={closeMenu}>
          <img src="/ladiesonthegreen.png?v=2" alt="" />
        </a>
        <a className="login-link" href="/members" onClick={closeMenu}>
          <span aria-hidden="true">●</span>
          Log In
        </a>
        <button className="menu-toggle" type="button" onClick={() => setMenuOpen((open) => !open)}>
          {menuOpen ? "Close" : "Menu"}
        </button>
        <nav className={menuOpen ? "is-open" : ""}>
          <NavLinks items={navItems} onNavigate={closeMenu} />
        </nav>
        <div className="header-actions">
          <a className="circle-link" href="/events" onClick={closeMenu} aria-label="Explore events">›</a>
          <a className="header-cta" href="/join" onClick={closeMenu}>Become A Member ↘</a>
          <a className="cart-link" href="#contact" onClick={closeMenu} aria-label="Join cart">0</a>
        </div>
      </header>

      <main id="top">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero__slideshow" aria-hidden="true">
            {heroSlides.map((slide, index) =>
              slide.type === "video" ? (
                <video
                  className={index === heroIndex ? "hero__slide is-active" : "hero__slide"}
                  key={slide.src}
                  ref={(video) => { heroVideoRefs.current[index] = video; }}
                  src={slide.src}
                  muted
                  playsInline
                  preload="auto"
                  onEnded={() => setHeroIndex((i) => (i + 1) % heroSlides.length)}
                />
              ) : (
                <img
                  className={index === heroIndex ? "hero__slide is-active" : "hero__slide"}
                  key={slide.src}
                  src={slide.src}
                  alt=""
                  style={{ objectPosition: slide.position }}
                />
              )
            )}
          </div>
          <div className="hero__scrim" aria-hidden="true" />
          <div className="hero__content">
            <p className="hero__name">Ladies On The Green Collective</p>
            <h1 id="hero-title">Our Strength Is Our Network</h1>
            <p>A curated collective of accomplished women connecting through golf, lifestyle, and elevated experiences.</p>
            <div className="hero__actions" aria-label="Primary actions">
              <a className="button button--light" href="/join">Become A Member</a>
              <a className="button button--gold" href="/events">Explore Our Signature Events ↘</a>
            </div>
          </div>
        </section>

        <section className="ticker" aria-label="Club highlights">
          <div>
            <span>Golf Clinics</span>
            <span>Networking Events</span>
            <span>Social Rounds</span>
            <span>Member Benefits</span>
            <span>Golf Clinics</span>
            <span>Networking Events</span>
          </div>
        </section>

        <section className="film" id="film" aria-labelledby="film-title">
          <div className="film__inner">
            <div className="section-heading">
              <span className="section-kicker">The Ladies On The Green Experience</span>
              <h2 id="film-title">The connections go beyond the course.</h2>
            </div>
            <div className="film__frame">
              <video
                src="/ladies-on-the-green-film.mp4?v=4"
                poster="/ladies-on-the-green-film-poster.jpg?v=4"
                controls
                playsInline
                preload="none"
                aria-label="Ladies On The Green: golf, friendship, and lifestyle highlights"
              />
            </div>
          </div>
        </section>

        <section className="about" id="collective" aria-labelledby="collective-title">
          <div className="section-kicker">About Ladies On The Green</div>
          <div className="about__grid">
            <h2 id="collective-title">A modern club for women taking up space in golf.</h2>
            <div className="about__copy">
              <p>
                Ladies on the Green® is a private golf and lifestyle collective bringing professional women together through golf, friendship, education, and elevated experiences in a welcoming environment.
              </p>
              <p>
                More than a membership, we are a community where women build meaningful relationships, explore new opportunities, and thrive together on and beyond the fairway.
              </p>
              <p>
                Our members enjoy curated golf, racquet, social, wellness, travel, and charitable experiences, with select events reserved exclusively for members. Whether you're new to golf or an experienced player, all skill levels are welcome.
              </p>
              <p className="about__network"><strong>Our Strength Is Our Network.</strong></p>
              <div className="about__welcome-actions">
                <a className="button button--gold" href="/join">Become a Member Today.</a>
                <a className="about__welcome-link" href="/join#welcome">Explore the Collective Experience ↗</a>
              </div>
            </div>
          </div>
        </section>

        <section className="events" id="events" aria-labelledby="events-title">
          <div className="section-heading">
            <span className="section-kicker">Featured Events</span>
            <h2 id="events-title">Golf experiences made to be seen, shared, and remembered.</h2>
          </div>
          <EventsLoading events={siteEvents} />
          {Array.isArray(siteEvents) && <EventCards events={siteEvents.slice(0, 1)} />}
          <div className="page-cta__row">
            <a className="button button--outline" href="/events">See all events ↘</a>
          </div>
        </section>

        <section className="moments" id="moments" aria-labelledby="moments-title">
          <div className="section-heading">
            <span className="section-kicker">Moments on the Green</span>
            <h2 id="moments-title">A glimpse of the course, the carts, and the golden hour.</h2>
          </div>
          <div className="moments-gallery">
            {momentsGallery.map((photo) => (
              <div className="moments-gallery__item" key={photo.src}>
                <img src={photo.src} alt={photo.alt} loading="lazy" />
              </div>
            ))}
          </div>
        </section>

        <section className="membership" id="membership" aria-labelledby="membership-title">
          <div className="membership__intro">
            <span className="section-kicker">Membership Benefits</span>
            <h2 id="membership-title">It is all about the benefits.</h2>
            <p>Choose a category to preview what members can expect as the club launches.</p>
          </div>
          <div className="benefit-tabs" role="tablist" aria-label="Membership benefit categories">
            {benefitTabs.map((benefit, index) => (
              <button
                aria-selected={activeBenefit === index}
                className={activeBenefit === index ? "is-active" : ""}
                key={benefit.label}
                onClick={() => setActiveBenefit(index)}
                role="tab"
                type="button"
              >
                {benefit.label}
              </button>
            ))}
          </div>
          <div className="benefit-panel">
            <div className="benefit-panel__media" aria-hidden="true">
              <img src="/ladiesonthegreen.png?v=2" alt="" />
            </div>
            <div>
              <h3>{currentBenefit.title}</h3>
              <ul>
                {currentBenefit.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="spotlight" id="spotlight" aria-labelledby="spotlight-title">
          <div className="spotlight__image" aria-hidden="true">
            <img src="/ladiesonthegreen.png?v=2" alt="" />
          </div>
          <div className="spotlight__copy">
            <span className="section-kicker">Member Spotlight</span>
            <h2 id="spotlight-title">Celebrating the women making the game their own.</h2>
            <p>
              Each season, Ladies On The Green will highlight members, partners, and leaders who bring confidence, generosity, and style to the course.
            </p>
          </div>
        </section>

        <section className="partners" aria-labelledby="partners-title">
          <span className="section-kicker">Partnerships</span>
          <h2 id="partners-title">Built with local courses, brands, and community hosts.</h2>
          <div className="partner-row">
            {partners.map((partner) => (
              <span key={partner}>{partner}</span>
            ))}
          </div>
        </section>

        <section className="contact" id="contact" aria-labelledby="contact-title">
          <div className="contact__copy">
            <span className="section-kicker">Join Us</span>
            <h2 id="contact-title">Want to attend Ladies On The Green events?</h2>
            <p>
              Send an inquiry and we will follow up with membership details, event openings, and founding member updates.
            </p>
            <a className="facebook-link" href={facebookUrl} target="_blank" rel="noreferrer">
              Follow on Facebook
            </a>
          </div>
          <form className="join-form" onSubmit={handleSubmit}>
            <label>
              Name
              <input name="name" type="text" autoComplete="name" required />
            </label>
            <label>
              Email
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <label>
              Interest
              <select name="interest" defaultValue="Membership">
                <option>Membership</option>
                <option>Events</option>
                <option>Lessons</option>
                <option>Sponsorship</option>
              </select>
            </label>
            <label>
              Message
              <textarea name="message" rows="5" required placeholder="I would love to learn more about..." />
            </label>
            <button className="button button--primary" type="submit" disabled={formState.status === "loading"}>
              {formState.status === "loading" ? "Sending" : "Send Inquiry"}
            </button>
            <p className={`form-status form-status--${formState.status}`} role="status">
              {formState.message}
            </p>
          </form>
        </section>
      </main>

      <footer className="site-footer">
        <div>
          <img src="/ladiesonthegreen.png?v=2" alt="" />
          <p>&copy; {new Date().getFullYear()} Ladies On The Green. Golf & Social Club.</p>
        </div>
        <div className="footer-links">
          <a href="/foundation">Foundation</a>
          <a href="mailto:hello@ladiesonthegreen.com">hello@ladiesonthegreen.com</a>
          <a href={facebookUrl} target="_blank" rel="noreferrer">Facebook</a>
          <a href="#top">Back to Top</a>
        </div>
      </footer>
    </>
  );
}

const routes = {
  "/test": TestMembershipPage,
  "/join": JoinPage,
  "/foundation": FoundationPage,
  "/magazine": MagazinePage,
  "/magazine/admin": MagazineAdminPage,
  "/admin": AdminPage,
  "/members": MembersPage,
  "/shop": ShopPage,
  "/events": EventsPage,
  "/connect": QuestionnairePage,
  "/questions": QuestionnairePage,
  "/about": AboutPage,
  "/girls-on-the-green": GirlsOnTheGreenPage
};
const pathname = window.location.pathname.replace(/\/+$/, "") || "/";
const PageComponent = routes[pathname];

const root = createRoot(document.getElementById("root"));

if (!PageComponent) {
  document.body.classList.add("landing-page");
  root.render(<App />);
} else {
  root.render(
    <Suspense fallback={<div className="page-loading">Loading...</div>}>
      <PageComponent />
    </Suspense>
  );
}
