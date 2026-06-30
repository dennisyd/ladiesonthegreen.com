import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const facebookUrl = "https://www.facebook.com/ladiesonthegreen";

const navItems = [
  { label: "Home", href: "#top" },
  { label: "About Us", href: "#about" },
  { label: "Join", href: "#contact" },
  { label: "Events", href: "#events" },
  { label: "Membership", href: "#membership" }
];

const stats = [
  { value: "01", label: "Golf Community" },
  { value: "04", label: "Event Styles" },
  { value: "All", label: "Skill Levels" }
];

const galleryEvents = [
  {
    title: "Welcome Scramble",
    tag: "Play",
    text: "A relaxed round designed to introduce members and make the first tee feel easy."
  },
  {
    title: "Range & Rose",
    tag: "Clinic",
    text: "Swing tips, short-game practice, and a social finish with the group."
  },
  {
    title: "Founding Brunch",
    tag: "Social",
    text: "A polished gathering for new members, partners, and local supporters."
  },
  {
    title: "Nine & Network",
    tag: "Connect",
    text: "Nine holes followed by intentional networking and conversation."
  },
  {
    title: "Course Confidence",
    tag: "Learn",
    text: "Etiquette, pace, club selection, and on-course support for newer golfers."
  },
  {
    title: "Pink Flag Classic",
    tag: "Signature",
    text: "A seasonal celebration of golf, friendship, and giving back."
  }
];

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

const partners = ["Courses", "Clinics", "Brands", "Local Hosts"];

function App() {
  const [formState, setFormState] = useState({ status: "idle", message: "" });
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeBenefit, setActiveBenefit] = useState(0);
  const currentBenefit = benefitTabs[activeBenefit];

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
          <img src="/ladiesonthegreen.png" alt="" />
          <span>Ladies On The Green</span>
        </a>
        <a className="login-link" href="#contact" onClick={closeMenu}>
          <span aria-hidden="true">●</span>
          Log In
        </a>
        <button className="menu-toggle" type="button" onClick={() => setMenuOpen((open) => !open)}>
          {menuOpen ? "Close" : "Menu"}
        </button>
        <nav className={menuOpen ? "is-open" : ""}>
          {navItems.map((item) => (
            <a href={item.href} key={item.href} onClick={closeMenu}>{item.label}</a>
          ))}
        </nav>
        <div className="header-actions">
          <a className="circle-link" href="#events" onClick={closeMenu} aria-label="Explore events">›</a>
          <a className="header-cta" href="#contact" onClick={closeMenu}>Join ↘</a>
          <a className="cart-link" href="#contact" onClick={closeMenu} aria-label="Join cart">0</a>
        </div>
      </header>

      <main id="top">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero__content">
            <img className="hero__logo" src="/ladiesonthegreen.png" alt="Ladies On The Green Golf & Social Club logo" />
            <p className="hero__name">Ladies On The Green</p>
            <h1 id="hero-title">Join, Connect, and Tee Off With Confidence</h1>
            <p>
              A welcoming golf and social club for women ready to learn the game, enjoy the course, and build real friendships along the way.
            </p>
            <div className="hero__actions" aria-label="Primary actions">
              <a className="button button--light" href="#contact">Join Now</a>
              <a className="button button--gold" href="#events">Explore Our Signature Events ↘</a>
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

        <section className="about" id="about" aria-labelledby="about-title">
          <div className="section-kicker">About Ladies On The Green</div>
          <div className="about__grid">
            <h2 id="about-title">A modern club for women taking up space in golf.</h2>
            <div className="about__copy">
              <p>
                The club blends golf, friendship, education, and lifestyle into events that feel elevated without feeling intimidating.
              </p>
              <p>
                Whether you are new to the game or already planning your next round, Ladies On The Green gives you a place to show up with confidence.
              </p>
            </div>
          </div>
          <div className="stats">
            {stats.map((stat) => (
              <div className="stat" key={stat.label}>
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="events" id="events" aria-labelledby="events-title">
          <div className="section-heading">
            <span className="section-kicker">Featured Events</span>
            <h2 id="events-title">Golf experiences made to be seen, shared, and remembered.</h2>
            <a className="text-link" href="#contact">Request the calendar</a>
          </div>
          <div className="event-gallery">
            {galleryEvents.map((event, index) => (
              <article className="gallery-card" key={event.title}>
                <div className="gallery-card__image">
                  <img src="/ladiesonthegreen.png" alt="" />
                </div>
                <div className="gallery-card__body">
                  <span>{event.tag}</span>
                  <h3>{event.title}</h3>
                  <p>{event.text}</p>
                  <small>{String(index + 1).padStart(2, "0")}</small>
                </div>
              </article>
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
              <img src="/ladiesonthegreen.png" alt="" />
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
            <img src="/ladiesonthegreen.png" alt="" />
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
          <img src="/ladiesonthegreen.png" alt="" />
          <p>&copy; {new Date().getFullYear()} Ladies On The Green. Golf & Social Club.</p>
        </div>
        <div className="footer-links">
          <a href="mailto:hello@ladiesonthegreen.com">hello@ladiesonthegreen.com</a>
          <a href={facebookUrl} target="_blank" rel="noreferrer">Facebook</a>
          <a href="#top">Back to Top</a>
        </div>
      </footer>
    </>
  );
}

createRoot(document.getElementById("root")).render(<App />);
