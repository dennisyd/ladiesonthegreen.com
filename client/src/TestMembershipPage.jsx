import React, { useEffect } from "react";
import { SiteFooter, SiteHeader } from "./SiteChrome.jsx";
import { FOUNDING_DEADLINE_LABEL, membershipRate, regularRate } from "../../shared/membership.js";
import "./test-membership.css";

const image = (name) => `/test-membership/${name}.jpg`;

const pillars = [
  {
    number: "01",
    title: "Find your footing",
    copy: "Learn the game in good company. Practice, ask questions, and grow your confidence one round at a time."
  },
  {
    number: "02",
    title: "Find your people",
    copy: "Meet women who make room for laughter, meaningful conversation, and a standing invitation to play."
  },
  {
    number: "03",
    title: "Find your next chapter",
    copy: "Explore new courses, experiences, connections, and possibilities that extend well beyond the green."
  }
];

const programs = [
  { number: "01", title: "Golf & growth", copy: "Lessons, practice sessions, clinics, and opportunities to play." },
  { number: "02", title: "The social side", copy: "Gatherings and introductions that turn a shared tee time into genuine connection." },
  { number: "03", title: "Wellness & lifestyle", copy: "Experiences that make space for joy, balance, and the life you are building." },
  { number: "04", title: "New destinations", copy: "Golf getaways and travel experiences worth looking forward to." }
];

const memberBenefits = [
  { title: "Group lessons", copy: "Learn and grow your game through golf instruction and small-group experiences." },
  { title: "Swing sessions", copy: "Make practice more fun with time at the range and women who encourage your progress." },
  { title: "Signature events", copy: "Connect through curated golf, social, and networking gatherings." },
  { title: "Local rounds", copy: "Find more reasons to get out and play through member outings and play days." },
  { title: "Wellness experiences", copy: "Make room for movement, balance, and moments that restore you." },
  { title: "Prestige experiences", copy: "Enjoy priority access to select experiences and VIP gatherings with Prestige Membership.", prestige: true },
  { title: "Private community", copy: "Keep the conversation going through member connections, invitations, and shared opportunities." },
  { title: "Golf getaways", copy: "Explore new courses and destinations through curated travel opportunities." },
  { title: "Partner privileges", copy: "Discover select offers and benefits from golf and lifestyle partners." }
];

function BenefitSpark() {
  return (
    <svg className="test-membership__spark" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      {Array.from({ length: 16 }, (_, index) => (
        <line key={index} x1="32" y1="5" x2="32" y2="21" transform={`rotate(${index * 22.5} 32 32)`} />
      ))}
      <circle cx="32" cy="32" r="3.5" />
    </svg>
  );
}

export default function TestMembershipPage() {
  const social = membershipRate("social");
  const prestige = membershipRate("prestige");

  useEffect(() => {
    document.title = "Membership Preview | Ladies on the Green®";
  }, []);

  return (
    <>
      <SiteHeader />
      <main className="test-membership" id="top">
        <section className="test-membership__hero" aria-labelledby="test-membership-title">
          <div className="test-membership__hero-copy">
            <span className="test-membership__eyebrow"><span /> Ladies on the Green® Membership</span>
            <h1 id="test-membership-title">Your game.<br />Your people.<br /><em>Your place.</em></h1>
            <p>Golf is only the beginning. Find a community of women who come to play, connect, grow, and enjoy everything the game can open up.</p>
            <div className="test-membership__actions">
              <a className="test-membership__button test-membership__button--gold" href="#experience">Discover the experience <span aria-hidden="true">↗</span></a>
              <a className="test-membership__text-link" href="#membership">Explore membership <span aria-hidden="true">↘</span></a>
            </div>
          </div>
          <div className="test-membership__hero-visual">
            <img src={image("arrival")} alt="Women golfers smiling together as they arrive at a clubhouse" fetchPriority="high" />
            <span className="test-membership__hero-caption">The best rounds are the ones we share.</span>
          </div>
        </section>

        <section className="test-membership__intro" id="experience" aria-labelledby="test-intro-title">
          <div className="test-membership__intro-head">
            <span className="test-membership__kicker">The invitation</span>
            <h2 id="test-intro-title">There is more to golf<br />when you <em>belong.</em></h2>
          </div>
          <p className="test-membership__intro-lead">You do not have to know the rules, own the perfect swing, or already have a foursome. Ladies on the Green® brings women together through golf, friendship, wellness, and experiences that feel as good off the course as they do on it.</p>
          <div className="test-membership__pillars">
            {pillars.map((pillar) => (
              <article className="test-membership__pillar" key={pillar.number}>
                <span>{pillar.number}</span>
                <h3>{pillar.title}</h3>
                <p>{pillar.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="test-membership__journey" aria-labelledby="test-journey-title">
          <div className="test-membership__section-heading">
            <span className="test-membership__kicker">Your golf journey</span>
            <h2 id="test-journey-title">A place to start.<br />A reason to stay.</h2>
            <p>Wherever you are in the game, there is room to make it yours.</p>
          </div>
          <div className="test-membership__journey-row">
            <div className="test-membership__journey-image"><img src={image("putting")} alt="Women golfers practicing a putt together" loading="lazy" /></div>
            <div className="test-membership__journey-copy">
              <span className="test-membership__mini-label">01 / New to golf</span>
              <h3>Start with confidence.</h3>
              <p>Discover the game with women who make every question welcome. Build skills, find golf friends, and enjoy your first rounds at your own pace.</p>
              <ul>
                <li>Learn through clinics and small-group instruction</li>
                <li>Practice with a welcoming community</li>
                <li>Move from the range to the course with confidence</li>
              </ul>
              <a className="test-membership__inline-link" href="/join">Find your place <span aria-hidden="true">↗</span></a>
            </div>
          </div>
          <div className="test-membership__journey-row test-membership__journey-row--reverse">
            <div className="test-membership__journey-image"><img src={image("tee-shot")} alt="Woman golfer finishing a drive as her friends cheer" loading="lazy" /></div>
            <div className="test-membership__journey-copy">
              <span className="test-membership__mini-label">02 / Already playing</span>
              <h3>Play with purpose.</h3>
              <p>Keep growing your game while expanding your circle. Share memorable rounds, explore premier courses, and make connections that travel with you.</p>
              <ul>
                <li>Enjoy member outings and play days</li>
                <li>Discover golf getaways and new destinations</li>
                <li>Connect across golf, business, and life</li>
              </ul>
              <a className="test-membership__inline-link" href="/join">See membership <span aria-hidden="true">↗</span></a>
            </div>
          </div>
        </section>

        <section className="test-membership__programs" aria-labelledby="test-programs-title">
          <div className="test-membership__programs-top">
            <div>
              <span className="test-membership__kicker">The Collective</span>
              <h2 id="test-programs-title">More than<br /><em>a tee time.</em></h2>
            </div>
            <p>Membership opens the door to a fuller experience: golf, connection, wellness, travel, and moments you will want to share.</p>
          </div>
          <div className="test-membership__programs-layout">
            <div className="test-membership__programs-photo"><img src={image("social")} alt="Women friends sharing a celebratory moment at a golf clubhouse" loading="lazy" /></div>
            <div className="test-membership__program-list">
              {programs.map((program) => (
                <article key={program.number}>
                  <span>{program.number}</span>
                  <div><h3>{program.title}</h3><p>{program.copy}</p></div>
                  <span aria-hidden="true">↗</span>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="test-membership__benefits" aria-labelledby="test-benefits-title">
          <div className="test-membership__benefits-head">
            <span className="test-membership__kicker">Your member experience</span>
            <h2 id="test-benefits-title">What you’ll get</h2>
            <p>Room to learn, play, connect, and enjoy everything around the game.</p>
          </div>
          <div className="test-membership__benefit-grid">
            {memberBenefits.map((benefit) => (
              <article className="test-membership__benefit" key={benefit.title}>
                <BenefitSpark />
                <h3>{benefit.title}</h3>
                <p>{benefit.copy}</p>
                {benefit.prestige && <span className="test-membership__benefit-tag">Prestige Membership</span>}
              </article>
            ))}
          </div>
          <p className="test-membership__benefits-note">Experiences and partner offers vary by membership and availability. Some require separate registration or payment.</p>
        </section>

        <section className="test-membership__tiers" id="membership" aria-labelledby="test-tiers-title">
          <div className="test-membership__section-heading">
            <span className="test-membership__kicker">Membership options</span>
            <h2 id="test-tiers-title">Choose how you belong.</h2>
            <p>Two ways into one extraordinary community.</p>
          </div>
          <div className="test-membership__tier-grid">
            <article className="test-membership__tier">
              <span className="test-membership__mini-label">The essential experience</span>
              <h3>Social Membership</h3>
              <p>For the woman ready for more golf, more connection, and more of the good life.</p>
              <div className="test-membership__tier-price">{social.isFounding && <s>${regularRate.amount}</s>}<strong>${social.amount}</strong><span>/ year</span></div>
              {social.isFounding && <p className="test-membership__rate-note">Founding rate through {FOUNDING_DEADLINE_LABEL}; then ${regularRate.amount}/year.</p>}
              <ul>
                <li>Golf outings, clinics, and social gatherings</li>
                <li>Member rates and partner offers</li>
                <li>Private member community and digital magazine</li>
                <li>Access to golf travel experiences</li>
              </ul>
              <a className="test-membership__button test-membership__button--dark" href="/join?tier=social#signup">Explore Social Membership <span aria-hidden="true">↗</span></a>
            </article>
            <article className="test-membership__tier test-membership__tier--featured">
              <span className="test-membership__tier-badge">Elevated access</span>
              <span className="test-membership__mini-label">The elevated experience</span>
              <h3>Founding Prestige</h3>
              <p>For the woman who wants the Collective experience with enhanced access and VIP connections.</p>
              <div className="test-membership__tier-price"><strong>${prestige.amount}</strong><span>/ year</span></div>
              <p className="test-membership__rate-note">Annual membership.</p>
              <ul>
                <li>Social Membership benefits</li>
                <li>Priority access to select experiences</li>
                <li>VIP gatherings and curated introductions</li>
                <li>Welcome gift and member spotlight</li>
              </ul>
              <a className="test-membership__button test-membership__button--gold" href="/join?tier=prestige#signup">Explore Prestige Membership <span aria-hidden="true">↗</span></a>
            </article>
          </div>
          <p className="test-membership__disclaimer">Annual memberships. Experiences and offers are subject to availability. Some events, travel, and green fees require separate registration or payment. See full details on the membership page.</p>
        </section>

        <section className="test-membership__faq" aria-labelledby="test-faq-title">
          <div>
            <span className="test-membership__kicker">Good to know</span>
            <h2 id="test-faq-title">A few questions<br />before your <em>first tee time?</em></h2>
            <a className="test-membership__inline-link" href="mailto:hello@ladiesonthegreen.com">Ask us anything <span aria-hidden="true">↗</span></a>
          </div>
          <div className="test-membership__faq-list">
            <details><summary>Do I need golf experience to join?</summary><p>No. The community welcomes women who are just discovering the game as well as those who already play. Clinics and practice opportunities can help you build confidence.</p></details>
            <details><summary>Are golf outings and events included?</summary><p>Membership includes access to member experiences and preferred rates. Some events or rounds require separate registration or payment; details are shared for each experience.</p></details>
            <details><summary>Is golf travel part of membership?</summary><p>Members can explore curated golf travel experiences. Trip costs and availability are shared separately.</p></details>
            <details><summary>Where can I compare both options?</summary><p>Visit the full membership page for a detailed side-by-side comparison and the signup form.</p></details>
          </div>
        </section>

        <section className="test-membership__closing" aria-labelledby="test-closing-title">
          <img src={image("sunset")} alt="Women golfers walking together across a course at sunset" loading="lazy" />
          <div>
            <span className="test-membership__kicker">Your invitation is open</span>
            <h2 id="test-closing-title">Come for the golf.<br /><em>Stay for everything else.</em></h2>
            <a className="test-membership__button test-membership__button--gold" href="/join">Become a member <span aria-hidden="true">↗</span></a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
