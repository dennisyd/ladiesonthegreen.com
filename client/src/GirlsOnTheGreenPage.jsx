import React, { useEffect, useState } from "react";
import { SiteFooter, SiteHeader } from "./SiteChrome.jsx";

const paragraphs = [
  "Girls on the Green | NextGen is a vibrant golf and lifestyle community for young women ages 18–29, including college students and emerging professionals.",
  "We believe golf is more than a game. It is access, confidence, community, and culture.",
  "Our mission is to create a pathway for the next generation of women to discover golf, build confidence, cultivate meaningful friendships, and develop valuable personal and professional connections.",
  "At the core of our community is intergenerational mentorship, connecting young women with accomplished professionals who share their knowledge and experiences, inspire, empower, and open doors.",
  "Through golf, social experiences, and mentorship, we're paving the way for the next generation of women to grow, lead, and thrive on and beyond the fairway."
];

export default function GirlsOnTheGreenPage() {
  const [state, setState] = useState({ status: "idle", message: "" });

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const { name, email, phone, age, affiliation, experience, message } = Object.fromEntries(new FormData(form).entries());
    const details = [
      phone && `Phone: ${phone}`,
      age && `Age: ${age}`,
      affiliation && `College/workplace: ${affiliation}`,
      `Golf experience: ${experience}`
    ].filter(Boolean).join("\n");
    setState({ status: "loading", message: "Sending..." });
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, interest: "Girls on the Green | NextGen", message: `${message}\n\n${details}` })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Something went wrong.");
      form.reset();
      setState({ status: "success", message: data.message });
    } catch (error) {
      setState({ status: "error", message: error.message || "Please try again in a moment." });
    }
  }

  useEffect(() => {
    document.title = "Girls on the Green | NextGen | Ladies on the Green®";
  }, []);

  return (
    <>
      <SiteHeader currentPath="/girls-on-the-green" />

      <main id="top">
        <section className="page-hero page-hero--banner" aria-labelledby="nextgen-heading">
          <figure className="page-banner">
            <img
              src="/nextgen-banner.jpg"
              alt="Girls on the Green: six young women in golf outfits walking together and laughing on a golf course"
              width="1024"
              height="381"
            />
          </figure>
          <div className="page-hero__text">
            <span className="page-hero__eyebrow">For the girls</span>
            <h1 id="nextgen-heading">Girls on the Green | NextGen</h1>
            <p className="page-hero__sub">An Initiative of Ladies on the Green®</p>
            <p className="page-hero__tagline">Learn the Game. Build Your Network. Find Your Circle.</p>
          </div>
        </section>

        <article className="page-article">
          {paragraphs.map((text, index) => (
            <p key={text.slice(0, 40)} className={index === 1 ? "page-article__statement" : undefined}>{text}</p>
          ))}
          <p className="page-quote">More than golf. Connecting generations. Creating opportunities.</p>
        </article>

        <section className="page-cta" id="get-in-touch" aria-labelledby="gotg-contact-heading">
          <form className="join-form gotg-form" onSubmit={handleSubmit}>
            <h2 id="gotg-contact-heading">Get in touch</h2>
            <p>Tell us a little about yourself and we will email you back about Girls on the Green | NextGen.</p>
            <label>
              Name
              <input name="name" type="text" autoComplete="name" required />
            </label>
            <label>
              Email
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <label>
              Phone (optional)
              <input name="phone" type="tel" autoComplete="tel" />
            </label>
            <label>
              Age
              <input name="age" type="text" inputMode="numeric" />
            </label>
            <label>
              College or workplace (optional)
              <input name="affiliation" type="text" />
            </label>
            <label>
              Golf experience
              <select name="experience" defaultValue="Brand new to golf">
                <option>Brand new to golf</option>
                <option>Some experience</option>
                <option>Play regularly</option>
              </select>
            </label>
            <label>
              Message
              <textarea name="message" rows="4" required />
            </label>
            <button className="button button--gold" type="submit" disabled={state.status === "loading"}>
              {state.status === "loading" ? "Sending..." : "Send message"}
            </button>
            <p className={`form-status form-status--${state.status}`} role="status">{state.message}</p>
          </form>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
