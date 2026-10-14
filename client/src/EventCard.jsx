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

// "exact" (a day), "month" (April 2027), "year" (2027) or "tba" (to be announced).
export function eventMode(event) {
  if (["exact", "month", "year", "tba"].includes(event.dateMode)) return event.dateMode;
  return event.date ? "exact" : "tba";
}

const TBA = "Date to be announced";

// The date as a sentence, e.g. "Saturday, October 24, 2026", "April 2027", "2027".
export function formatEventWhen(event, style = "long") {
  const mode = eventMode(event);
  if (mode === "exact") {
    const date = parseEventDate(event.date);
    if (!date) return TBA;
    return date.toLocaleDateString(
      "en-US",
      style === "long" ? { weekday: "long", month: "long", day: "numeric", year: "numeric" } : { weekday: "short", month: "short", day: "numeric", year: "numeric" }
    );
  }
  if (mode === "month") {
    const match = /^(\d{4})-(\d{2})$/.exec(event.date || "");
    return match ? new Date(Number(match[1]), Number(match[2]) - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : TBA;
  }
  if (mode === "year") return /^\d{4}$/.test(event.date || "") ? event.date : TBA;
  return TBA;
}

// The little date badge: a small top line and a big line.
export function eventBadge(event) {
  const mode = eventMode(event);
  if (mode === "exact") {
    const date = parseEventDate(event.date);
    if (date) return { top: date.toLocaleDateString("en-US", { month: "short" }), big: String(date.getDate()) };
  }
  if (mode === "month") {
    const match = /^(\d{4})-(\d{2})$/.exec(event.date || "");
    if (match) {
      return { top: new Date(Number(match[1]), Number(match[2]) - 1, 1).toLocaleDateString("en-US", { month: "short" }), big: match[1] };
    }
  }
  if (mode === "year" && /^\d{4}$/.test(event.date || "")) return { top: "", big: event.date };
  return { top: "Date", big: "TBA" };
}

const Icon = ({ children }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

export function EventCard({ event, featured = false, preview = false }) {
  const badge = eventBadge(event);
  const time = eventMode(event) === "exact" ? formatEventTime(event.startTime, event.endTime) : "";
  const where = event.locationTbd ? "Location to be determined" : event.location;

  return (
    <article className={`event-card${featured ? " event-card--featured" : ""}`}>
      {event.image && (
        <div className="event-card__image">
          <img src={event.image} alt="" loading="lazy" />
        </div>
      )}
      <div className="event-card__body">
        <div className="event-card__date" aria-hidden="true">
          {badge.top && <span>{badge.top}</span>}
          <strong className={badge.big.length > 3 ? "is-long" : ""}>{badge.big}</strong>
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
              <span>{formatEventWhen(event)}</span>
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
            {where && (
              <li>
                <Icon>
                  <path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" />
                  <circle cx="12" cy="9" r="2.5" />
                </Icon>
                <span>{where}</span>
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
