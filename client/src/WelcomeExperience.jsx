import React, { useState } from "react";

const experiences = [
  {
    id: "golf",
    title: "Golf, Elevated",
    subtitle: "Learn. Play. Grow.",
    image: "/welcome/golf-clinic.jpeg",
    alt: "A golf instructor helping a woman practice her swing during a group clinic",
    paragraphs: [
      "Whether you’re picking up a club for the first time or refining your game, our goal is to make quality golf instruction approachable, enjoyable, and accessible.",
      "Through our golf partnerships, members enjoy opportunities to participate in professionally led clinics, group lessons, and organized play days at preferred member rates.",
      "We prioritize smaller groups and personalized instruction, creating an environment where women can learn comfortably, build confidence, and develop their skills.",
      "Select clinics will offer a limited number of reservations to preserve the quality of the experience."
    ]
  },
  {
    id: "partnerships",
    title: "The Privilege of Partnership",
    subtitle: "More Connections. More Possibilities.",
    image: "/welcome/golf-partnerships.jpeg",
    alt: "A diverse group of women enjoying time together on the golf course",
    paragraphs: [
      "Your membership extends beyond the golf course.",
      "Through our growing network of golf and lifestyle partners, members may enjoy preferred green fees, special promotions, golf apparel and accessory offers, and invitations to exclusive partner experiences.",
      "Our partnerships are designed to bring meaningful value to membership while introducing women to new courses, brands, and opportunities."
    ]
  },
  {
    id: "social",
    title: "The Social Collective",
    subtitle: "Where Connections Become Friendships.",
    image: "/welcome/social-collective.jpeg",
    alt: "Women sharing a toast and conversation around a brunch table",
    paragraphs: [
      "Some of life’s most meaningful connections happen away from the fairway.",
      "Enjoy a thoughtfully curated calendar of social experiences, including intimate gatherings, networking socials, private receptions, brunches, cultural outings, and member meetups.",
      "Our calendar will include a combination of complimentary member gatherings and specially priced experiences, offering opportunities to connect in ways that complement your lifestyle."
    ]
  },
  {
    id: "wellness",
    title: "Wellness & Lifestyle",
    subtitle: "Restore. Recharge. Reconnect.",
    image: "/welcome/beach-wellness.jpeg",
    alt: "A group enjoying a wellness and movement session beside the water on the beach",
    paragraphs: [
      "We believe an elevated lifestyle includes caring for the mind, body, and spirit.",
      "Members will have opportunities to enjoy wellness conversations, fitness experiences, self-care gatherings, and activities that encourage balance and personal growth.",
      "Select wellness events will be complimentary, while others may offer preferred member pricing."
    ]
  },
  {
    id: "travel",
    title: "Destinations & Discoveries",
    subtitle: "Travel Beautifully. Connect Meaningfully.",
    image: "/welcome/golf-destinations.jpeg",
    alt: "Four women golfers overlooking a coastal golf course and turquoise water",
    paragraphs: [
      "From memorable golf weekends to international destinations, our curated travel experiences bring together women who appreciate adventure, culture, relaxation, and exceptional company.",
      "Discover new courses, beautiful destinations, luxury accommodations, and unforgettable experiences while building friendships that travel far beyond the fairway.",
      "Members receive invitations to upcoming travel experiences, with Founding Prestige members enjoying priority access to select limited-capacity opportunities."
    ]
  },
  {
    id: "purpose",
    title: "Serve. Lead. Love.",
    subtitle: "Connection With Purpose.",
    image: "/welcome/girls-on-the-green.jpeg",
    alt: "A woman helping a young girl learn to swing a golf club",
    paragraphs: [
      "Our Collective is built on the belief that true influence is measured not only by the connections we make, but also by the lives we touch.",
      "Through Girls on the Green initiatives, mentorship, charitable experiences, and community outreach, we create opportunities for members to share their knowledge, support future generations, and make a meaningful difference.",
      "Every member is invited to contribute, participate, and lead in ways that feel personally meaningful."
    ],
    link: { href: "/girls-on-the-green", label: "Discover Girls on the Green ↗" }
  },
  {
    id: "prestige",
    title: "The Founding Prestige Experience",
    subtitle: "An Elevated Level of Belonging.",
    image: "/hero-4.jpg",
    alt: "Ladies On The Green members gathered together at the clubhouse",
    paragraphs: [
      "For women who desire a more exclusive experience, Founding Prestige membership offers enhanced access to the Collective.",
      "Enjoy priority registration for select golf clinics and experiences, invitations to intimate VIP gatherings, curated member introductions, special partner privileges, and exclusive opportunities to connect with the founder and fellow members.",
      "Founding Prestige members also receive a signature welcome gift, two printed editions of our quarterly magazine delivered annually, and a featured member spotlight.",
      "It’s a more personalized way to experience the relationships, opportunities, and distinctive lifestyle of Ladies on the Green®."
    ]
  }
];

export default function WelcomeExperience() {
  const [openId, setOpenId] = useState("golf");

  return (
    <section className="welcome-experience" id="welcome" aria-labelledby="welcome-title">
      <header className="welcome-experience__intro">
        <span className="section-kicker">The Collective Experience</span>
        <h1 id="welcome-title">Welcome to Ladies on the Green<sup>®</sup></h1>
        <p className="welcome-experience__tagline">Beyond the Fairway. Beyond the Ordinary.</p>
        <p>At Ladies on the Green®, we believe exceptional experiences should be both accessible and memorable. Through relationships with golf courses, PGA professionals, and lifestyle partners, we create opportunities for women to learn, play, connect, and explore in welcoming, thoughtfully curated settings.</p>
        <p>From intimate golf clinics and championship courses to wellness gatherings, private social experiences, and destination getaways, every experience is designed to inspire confidence, cultivate friendships, and expand your circle.</p>
      </header>

      <div className="welcome-accordion">
        {experiences.map((experience, index) => {
          const open = openId === experience.id;
          const buttonId = `welcome-toggle-${experience.id}`;
          const panelId = `welcome-panel-${experience.id}`;
          return (
            <article className={`welcome-accordion__item${open ? " is-open" : ""}`} key={experience.id}>
              <h2 className="welcome-accordion__heading">
                <button type="button" id={buttonId} aria-expanded={open} aria-controls={panelId} onClick={() => setOpenId(open ? null : experience.id)}>
                  <span className="welcome-accordion__number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                  <span className="welcome-accordion__label">
                    <span>{experience.title}</span>
                    <span className="welcome-accordion__subtitle">{experience.subtitle}</span>
                  </span>
                  <span className="welcome-accordion__icon" aria-hidden="true">{open ? "−" : "+"}</span>
                </button>
              </h2>
              <div className="welcome-accordion__panel" id={panelId} role="region" aria-labelledby={buttonId} hidden={!open}>
                {open && (
                  <div className="welcome-accordion__body">
                    <img src={experience.image} alt={experience.alt} loading="lazy" decoding="async" />
                    <div className="welcome-accordion__copy">
                      {experience.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                      {experience.link && <a href={experience.link.href}>{experience.link.label}</a>}
                    </div>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <footer className="welcome-experience__closing">
        <h2>One Collective. Endless Possibilities.</h2>
        <p>Whether you’re here to discover golf, deepen friendships, expand your network, travel, or make a difference, there is a place for you.</p>
        <p className="welcome-experience__invitation">Come for the golf. Stay for the friendships. Leave inspired.</p>
        <p><strong>Our Strength Is Our Network.</strong></p>
        <small>All experiences, partner offers, and preferred rates are subject to availability. Some events are complimentary, while others require separate registration or payment.</small>
      </footer>
    </section>
  );
}
