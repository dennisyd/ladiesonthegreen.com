import React from "react";

// One member event, as shown in the member portal. The admin "Portal events"
// editor reuses it for its live preview, so what you see there is what members get.

function formatClock(value) {
  const [hours, minutes] = value.split(":").map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`;
}

export function formatEventTime(start, end) {
  if (!start) return "";
  return end ? `${formatClock(start)} – ${formatClock(end)}` : formatClock(start);
}

export function parseEventDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

const Icon = ({ children }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

export function EventCard({ event, featured = false, preview = false }) {
  const date = parseEventDate(event.date);
  const time = formatEventTime(event.startTime, event.endTime);

  return (
    <article className={`event-card${featured ? " event-card--featured" : ""}`}>
      {event.image && (
        <div className="event-card__image">
          <img src={event.image} alt="" loading="lazy" />
        </div>
      )}
      <div className="event-card__body">
        <div className="event-card__date" aria-hidden="true">
          <span>{date ? date.toLocaleDateString("en-US", { month: "short" }) : "—"}</span>
          <strong>{date ? date.getDate() : "—"}</strong>
        </div>
        <div className="event-card__main">
          {featured && <span className="event-card__tag">Next up</span>}
          <h3>{event.title || "Event title"}</h3>
          <ul className="event-card__meta">
            <li>
              <Icon>
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M3 10h18M8 3v4M16 3v4" />
              </Icon>
              <span>
                {date ? date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }) : "Date to be announced"}
              </span>
            </li>
            {time && (
              <li>
                <Icon>
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </Icon>
                <span>{time}</span>
              </li>
            )}
            {event.location && (
              <li>
                <Icon>
                  <path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" />
                  <circle cx="12" cy="9" r="2.5" />
                </Icon>
                <span>{event.location}</span>
              </li>
            )}
          </ul>
          {event.description && <p className="event-card__text">{event.description}</p>}
          {event.link &&
            (preview ? (
              <span className="button button--gold event-card__cta">{event.linkLabel || "RSVP & details"}</span>
            ) : (
              <a className="button button--gold event-card__cta" href={event.link} target="_blank" rel="noopener noreferrer">
                {event.linkLabel || "RSVP & details"}
              </a>
            ))}
        </div>
      </div>
    </article>
  );
}
