import React, { useEffect } from "react";
import { SiteFooter, SiteHeader } from "./SiteChrome.jsx";

const paragraphs = [
  "Girls on the Green | NextGen is a vibrant golf and lifestyle community for young women ages 18–29, including college students and emerging professionals.",
  "We believe golf is more than a game. It is access, confidence, community, and culture.",
  "Our mission is to create a pathway for the next generation of women to discover golf, build confidence, cultivate meaningful friendships, and develop valuable personal and professional connections.",
  "At the core of our community is intergenerational mentorship, connecting young women with accomplished professionals who share their knowledge and experiences, inspire, empower, and open doors.",
  "Through golf, social experiences, and mentorship, we're paving the way for the next generation of women to grow, lead, and thrive on and beyond the fairway."
];

export default function GirlsOnTheGreenPage() {
  useEffect(() => {
    document.title = "Girls on the Green | NextGen | Ladies on the Green®";
  }, []);

  return (
    <>
      <SiteHeader currentPath="/girls-on-the-green" />

      <main id="top">
        <section className="page-hero" aria-labelledby="nextgen-heading">
          <div className="page-hero__text">
            <span className="page-hero__eyebrow">For the girls</span>
            <h1 id="nextgen-heading">Girls on the Green | NextGen</h1>
            <p className="page-hero__sub">An Initiative of Ladies on the Green®</p>
            <p className="page-hero__tagline">Learn the Game. Build Your Network. Find Your Circle.</p>
          </div>
          <div className="page-hero__image">
            <img
              src="/nextgen-hero.jpg"
              alt="A smiling young woman on a golf course with her golf bag"
              style={{ objectPosition: "center 30%" }}
            />
          </div>
        </section>

        <article className="page-article">
          {paragraphs.map((text, index) => (
            <p key={text.slice(0, 40)} className={index === 1 ? "page-article__statement" : undefined}>{text}</p>
          ))}
          <p className="page-quote">More than golf. Connecting generations. Creating opportunities.</p>
        </article>

        <section className="page-cta" aria-label="Get in touch">
          <div className="page-cta__row">
            <a className="button button--gold" href="/#contact">Get in touch</a>
            <a className="button button--outline" href="/about">About Ladies on the Green®</a>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
