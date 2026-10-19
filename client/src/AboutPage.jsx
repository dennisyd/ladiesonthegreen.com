import React, { useEffect } from "react";
import { SiteFooter, SiteHeader } from "./SiteChrome.jsx";

const NEXTGEN = "Girls on the Green | NextGen";

const paragraphs = [
  "Founded by Martine “Dee” Dennis, Founder & CEO, Ladies on the Green® | The Collective is a private golf and lifestyle community connecting accomplished women through golf, meaningful friendships, professional networking, and elevated experiences.",
  "We believe the best part of a golf club isn't about your handicap or how well you play. It's about the laughter, camaraderie, unforgettable experiences, and connections that last long after the final hole. Because sometimes, the greatest thing you gain from golf isn't a better swing. It's finding your circle.",
  "Our members enjoy curated golf, racquet, social, wellness, luxury travel, and charitable experiences, along with exclusive member perks and members-only events. All skill levels are welcome.",
  `Through ${NEXTGEN}, our initiative for young women ages 18–29, we're creating a pathway to discover golf, build confidence, and develop meaningful personal and professional connections.`,
  "At its core is intergenerational mentorship, paving the way for the next generation of young women through guidance, meaningful connections, and opportunities to learn from accomplished women who inspire, empower, and open doors.",
  "More than a membership, we're a community where women connect, inspire, and thrive together on and beyond the fairway."
];

// The NextGen initiative has its own page, so link its name wherever it appears.
function withNextGenLink(text) {
  const at = text.indexOf(NEXTGEN);
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <a className="page-link" href="/girls-on-the-green">{NEXTGEN}</a>
      {text.slice(at + NEXTGEN.length)}
    </>
  );
}

export default function AboutPage() {
  useEffect(() => {
    document.title = "About Us | Ladies on the Green®";
  }, []);

  return (
    <>
      <SiteHeader currentPath="/about" />

      <main id="top">
        <section className="page-hero" aria-labelledby="about-heading">
          <div className="page-hero__text">
            <span className="page-hero__eyebrow">Ladies on the Green®</span>
            <h1 id="about-heading">About Us</h1>
          </div>
          <div className="page-hero__image">
            <img
              src="/hero-sunset-friends-landscape.png"
              alt="Three women standing together on the shore at sunset"
              style={{ objectPosition: "42% center" }}
            />
          </div>
        </section>

        <article className="page-article">
          {paragraphs.map((text) => (
            <p key={text.slice(0, 40)}>{withNextGenLink(text)}</p>
          ))}
          <p className="page-quote">Our Strength Is Our Network</p>
        </article>

        <section className="page-cta" aria-label="Become a member">
          <div className="about__invitation">
            <h3>Your Place in the Collective Awaits</h3>
            <p>Experience the connections, opportunities, and privileges of belonging.</p>
            <a className="button button--gold" href="/join">Become a Member Today!</a>
            <p className="about__closing">Come for the golf. Stay for the friendships. Leave inspired.</p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
