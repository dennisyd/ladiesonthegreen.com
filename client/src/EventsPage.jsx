import React, { useEffect, useState } from "react";
import { SiteFooter, SiteHeader } from "./SiteChrome.jsx";
import { galleryEvents } from "./eventsData.js";
import { eventMode, formatEventTime, formatEventWhen } from "./EventCard.jsx";

// Turns an event saved in /admin → Site events into what the card shows.
export function toCardEvent(event, isNext = false) {
  const time = eventMode(event) === "exact" ? formatEventTime(event.startTime, event.endTime) : "";
  const where = event.locationTbd ? "Location to be determined" : event.location;
  const extra = String(event.extraDetails || "").split(/\r?\n/).filter(Boolean);
  const past = Boolean(event.isPast);
  return {
    id: event.id,
    image: event.image,
    alt: `${event.title} flyer`,
    badge: past ? "Past Event" : isNext ? "Next Event" : "Upcoming Event",
    title: event.title,
    host: event.tagline,
    details: [[formatEventWhen(event), time].filter(Boolean).join(" · "), where, ...extra].filter(Boolean),
    text: event.description,
    tallImage: event.tallImage !== false,
    cta: event.link && !past ? { label: event.linkLabel || "RSVP & details", href: event.link, external: true } : null,
    pastNote: past ? event.pastNote || "This event has taken place" : ""
  };
}

export function EventCards({ events, preview = false }) {
  const firstUpcoming = events.findIndex((event) => !event.isPast);
  return (
    <>
      {events.map((raw, index) => {
        const event = toCardEvent(raw, index === firstUpcoming);
        return (
          <article
            className={`featured-event${event.tallImage ? " featured-event--tall" : ""}${event.pastNote ? " featured-event--past" : ""}`}
            key={event.id ?? event.title}
          >
            {event.image && (
              <div className="featured-event__image">
                <img src={event.image} alt={event.alt} />
              </div>
            )}
            <div className="featured-event__body">
              <span className="featured-event__badge">{event.badge}</span>
              <h3>{event.title || "Event title"}</h3>
              {event.host && <p className="featured-event__host">{event.host}</p>}
              <ul className="featured-event__details">
                {event.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
              {event.text && <p>{event.text}</p>}
              {event.cta ? (
                <a
                  className="button button--gold"
                  href={preview ? undefined : event.cta.href}
                  {...(event.cta.external && !preview ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                >
                  {event.cta.label}
                </a>
              ) : (
                event.pastNote && <p className="featured-event__past">{event.pastNote}</p>
              )}
            </div>
          </article>
        );
      })}
    </>
  );
}

// The events saved in the admin; null while loading, false if they could not be loaded.
export function useSiteEvents() {
  const [events, setEvents] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/events")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("failed"))))
      .then((data) => !cancelled && setEvents(data.events))
      .catch(() => !cancelled && setEvents(false));
    return () => {
      cancelled = true;
    };
  }, []);
  return events;
}

export function EventsLoading({ events }) {
  if (events === null) return <p className="page-loading">Loading events...</p>;
  if (events === false) return <p className="page-loading">Events could not be loaded right now. Please try again in a moment.</p>;
  if (events.length === 0) return <p className="page-loading">New events are coming soon. Check back shortly.</p>;
  return null;
}

export default function EventsPage() {
  const events = useSiteEvents();

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
          <EventsLoading events={events} />
          {Array.isArray(events) && <EventCards events={events} />}
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
