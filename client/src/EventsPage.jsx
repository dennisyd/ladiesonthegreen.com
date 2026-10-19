import React, { useEffect } from "react";
import { SiteFooter, SiteHeader } from "./SiteChrome.jsx";
import { featuredEvents, galleryEvents } from "./eventsData.js";

export function EventCards({ events }) {
  return (
    <>
      {events.map((event) => (
        <article
          className={`featured-event${event.tallImage ? " featured-event--tall" : ""}${event.pastNote ? " featured-event--past" : ""}`}
          key={event.id ?? event.title}
        >
          <div className="featured-event__image">
            <img src={event.image} alt={event.alt} />
          </div>
          <div className="featured-event__body">
            <span className="featured-event__badge">{event.badge}</span>
            <h3>{event.title}</h3>
            <p className="featured-event__host">{event.host}</p>
            <ul className="featured-event__details">
              {event.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
            <p>{event.text}</p>
            {event.cta ? (
              <a
                className="button button--gold"
                href={event.cta.href}
                {...(event.cta.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              >
                {event.cta.label}
              </a>
            ) : (
              <p className="featured-event__past">{event.pastNote}</p>
            )}
          </div>
        </article>
      ))}
    </>
  );
}

export default function EventsPage() {
  useEffect(() => {
    document.title = "Events | Ladies on the Green®";
  }, []);

  return (
    <>
      <SiteHeader currentPath="/events" />

      <main id="top">
        <section className="page-hero page-hero--simple" aria-labelledby="events-heading">
          <div className="page-hero__text">
            <span className="page-hero__eyebrow">Ladies on the Green®</span>
            <h1 id="events-heading">Events</h1>
            <p className="page-hero__tagline">Golf experiences made to be seen, shared, and remembered.</p>
          </div>
        </section>

        <section className="events" aria-label="Events">
          <EventCards events={featuredEvents} />
      <div className="event-gallery">
        {galleryEvents.map((event, index) => (
          <article className="gallery-card" key={event.title}>
            <div className="gallery-card__image">
              <img src="/ladiesonthegreen.png?v=2" alt="" />
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
      </main>

      <SiteFooter />
    </>
  );
}
