import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { SiteFooter, SiteHeader } from "./SiteChrome.jsx";
import { OTHER, QUESTIONNAIRE, US_STATES, isValidEmail, isVisible, otherKey } from "../../shared/questionnaire.js";

// Pick a state by typing: the list narrows to states starting with what was typed
// (then any that contain it); arrow keys and Enter also work.
function StateSelect({ id, value, onChange, required }) {
  const listId = useId();
  const [text, setText] = useState(value || "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef(null);

  useEffect(() => setText(value || ""), [value]);

  const matches = useMemo(() => {
    const q = text.trim().toLowerCase();
    if (!q || US_STATES.some((s) => s.toLowerCase() === q)) return US_STATES;
    return [...US_STATES.filter((s) => s.toLowerCase().startsWith(q)), ...US_STATES.filter((s) => !s.toLowerCase().startsWith(q) && s.toLowerCase().includes(q))];
  }, [text]);

  function choose(state) {
    onChange(state);
    setText(state);
    setOpen(false);
  }

  function onKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && open && matches[active]) {
      e.preventDefault();
      choose(matches[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  // The highlighted row stays in view while arrowing through a long list.
  useEffect(() => {
    box.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  return (
    <div className="qn-combo">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder="Start typing, e.g. M for Maryland"
        value={text}
        required={required}
        onChange={(e) => {
          setText(e.target.value);
          onChange("");
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Keep only a real state; otherwise clear so a typo can't be submitted.
          setTimeout(() => {
            setOpen(false);
            const exact = US_STATES.find((s) => s.toLowerCase() === text.trim().toLowerCase());
            if (exact) choose(exact);
            else if (!value) setText("");
          }, 120);
        }}
        onKeyDown={onKeyDown}
      />
      <span className="qn-combo__chevron" aria-hidden="true">▾</span>
      {open && (
        <ul id={listId} role="listbox" className="qn-combo__list" ref={box}>
          {matches.length === 0 && <li className="qn-combo__empty">No matching state</li>}
          {matches.map((state, i) => (
            <li
              key={state}
              role="option"
              aria-selected={i === active}
              className={`${i === active ? "is-active " : ""}${state === value ? "is-chosen" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(state);
              }}
              onMouseEnter={() => setActive(i)}
            >
              {state}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Choices({ question, answers, setAnswer }) {
  const multi = question.type === "checkbox";
  const options = question.other ? [...question.options, OTHER] : question.options;
  const current = answers[question.id];
  const isOn = (option) => (multi ? (current || []).includes(option) : current === option);
  const toggle = (option) => {
    if (!multi) return setAnswer(question.id, option);
    const list = current || [];
    setAnswer(question.id, list.includes(option) ? list.filter((o) => o !== option) : [...list, option]);
  };
  const otherOn = question.other && isOn(OTHER);

  return (
    <div className="qn-choices" role={multi ? "group" : "radiogroup"} aria-labelledby={`${question.id}-label`}>
      {options.map((option) => (
        <label key={option} className={`qn-choice${isOn(option) ? " is-on" : ""}`}>
          <input
            type={multi ? "checkbox" : "radio"}
            name={question.id}
            checked={isOn(option)}
            onChange={() => toggle(option)}
          />
          <span className="qn-choice__mark" aria-hidden="true" />
          <span>{option === OTHER ? "Other (please specify)" : option}</span>
        </label>
      ))}
      {otherOn && (
        <input
          className="qn-other"
          type="text"
          maxLength={200}
          placeholder="Please specify"
          aria-label={`${question.label} — other`}
          value={answers[otherKey(question.id)] || ""}
          onChange={(e) => setAnswer(otherKey(question.id), e.target.value)}
          autoFocus
        />
      )}
    </div>
  );
}

function Question({ question, number, answers, setAnswer }) {
  const id = `q-${question.id}`;
  return (
    <div className={`qn-question${question.showIf ? " qn-question--reveal" : ""}`}>
      <div className="qn-question__head">
        <label className="qn-question__label" id={`${question.id}-label`} htmlFor={["radio", "checkbox"].includes(question.type) ? undefined : id}>
          <span className="qn-question__number">{number}</span>
          <span>
            {question.label}
            {question.required && <span className="qn-required" title="Required"> *</span>}
          </span>
        </label>
        {question.hint && <p className="qn-hint">{question.hint}</p>}
      </div>
      {question.type === "state" && (
        <StateSelect id={id} value={answers[question.id] || ""} required={question.required} onChange={(v) => setAnswer(question.id, v)} />
      )}
      {question.type === "textarea" && (
        <textarea id={id} rows={4} maxLength={question.max} value={answers[question.id] || ""} onChange={(e) => setAnswer(question.id, e.target.value)} />
      )}
      {(question.type === "text" || question.type === "email") && (
        <input
          id={id}
          type={question.type}
          maxLength={question.max}
          required={question.required}
          autoComplete={question.id === "email" ? "email" : question.id === "firstName" ? "given-name" : question.id === "lastName" ? "family-name" : "off"}
          value={answers[question.id] || ""}
          onChange={(e) => setAnswer(question.id, e.target.value)}
        />
      )}
      {(question.type === "radio" || question.type === "checkbox") && <Choices question={question} answers={answers} setAnswer={setAnswer} />}
    </div>
  );
}

function goToQuestionnaire(e) {
  e.preventDefault();
  document.getElementById("questionnaire")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

const CONTACTS = [
  { label: "Membership", email: "membership@ladiesonthegreen.com" },
  { label: "Partnerships", email: "partnerships@ladiesonthegreen.com" }
];

export default function QuestionnairePage() {
  const [answers, setAnswers] = useState({});
  const [website, setWebsite] = useState("");
  const [state, setState] = useState({ status: "idle", message: "" });

  useEffect(() => {
    document.title = `${QUESTIONNAIRE.title} | Ladies on the Green®`;
  }, []);

  const setAnswer = (id, value) => setAnswers((a) => ({ ...a, [id]: value }));

  async function submit(event) {
    event.preventDefault();
    // Required choice questions can't use the browser's own check, so check them here.
    for (const q of QUESTIONNAIRE.sections.flatMap((s) => s.questions)) {
      if (!isVisible(q, answers) || !q.required) continue;
      const value = answers[q.id];
      if (!value || (Array.isArray(value) && value.length === 0)) {
        setState({ status: "error", message: `Please answer: ${q.label.replace(/\?$/, "")}.` });
        document.getElementById(`${q.id}-label`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }
    const email = (answers.email || "").trim();
    if (!isValidEmail(email)) {
      setState({ status: "error", message: "Please enter a valid email address, like name@example.com." });
      const field = document.getElementById("q-email");
      field?.scrollIntoView({ behavior: "smooth", block: "center" });
      field?.focus();
      return;
    }
    setState({ status: "loading", message: "Sending..." });
    try {
      const response = await fetch("/api/questionnaire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: { ...answers, email }, website })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Something went wrong. Please try again.");
      setState({ status: "done", message: "" });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setState({ status: "error", message: error.message || "Please try again in a moment." });
    }
  }

  let number = 0;

  return (
    <>
      <SiteHeader currentPath="/connect" />

      <main id="top" className="qn">
        <section className="contact-us" aria-labelledby="contact-us-heading">
          <div className="contact-us__marquee" aria-hidden="true">
            <div className="contact-us__track">
              {Array.from({ length: 8 }, (_, i) => (
                <span key={i}>Contact Us</span>
              ))}
            </div>
          </div>
          <h2 id="contact-us-heading" className="sr-only">Contact us</h2>
          <div className="contact-us__body">
            <div className="contact-us__text">
              <p>
                Questions about membership, or ideas for working together? Reach the right team directly. We read every message
                and reply as soon as we can.
              </p>
              <ul>
                {CONTACTS.map((c) => (
                  <li key={c.label}>
                    <strong>{c.label}</strong> <span aria-hidden="true">|</span> <a href={`mailto:${c.email}`}>{c.email}</a>
                  </li>
                ))}
              </ul>
              <a className="button button--gold contact-us__button" href="#questionnaire" onClick={goToQuestionnaire}>
                Take Our Questionnaire ↓
              </a>
            </div>
            <figure className="contact-us__photo">
              <img src="/connect-hey.jpg" alt="Hey! Let's connect. The Ladies on the Green clubhouse at golden hour." width="800" height="600" />
              <a
                className="contact-us__cta"
                href="#questionnaire"
                aria-label="Take our questionnaire"
                onClick={goToQuestionnaire}
              />
            </figure>
          </div>
        </section>

        <section className="page-hero page-hero--simple" id="questionnaire" aria-labelledby="qn-heading">
          <div className="page-hero__text">
            <span className="page-hero__eyebrow">Ladies on the Green®</span>
            <h1 id="qn-heading">{QUESTIONNAIRE.title}</h1>
            <p className="page-hero__tagline">{QUESTIONNAIRE.intro}</p>
          </div>
        </section>

        {state.status === "done" ? (
          <section className="qn-thanks" role="status">
            <h2>{QUESTIONNAIRE.closing.heading}</h2>
            <p>{QUESTIONNAIRE.closing.text}</p>
            <a className="button button--gold" href="/">Back to the home page</a>
          </section>
        ) : (
          <form className="qn-form" onSubmit={submit} noValidate>
            <p className="qn-note">Questions marked <span className="qn-required">*</span> are required.</p>

            {QUESTIONNAIRE.sections.map((section, index) => (
              <fieldset className="qn-section" key={section.title}>
                <legend>
                  <span>Section {index + 1}</span>
                  {section.title}
                </legend>
                {section.questions.filter((q) => isVisible(q, answers)).map((q) => (
                  <Question key={q.id} question={q} number={q.showIf || q.sub ? "" : ++number} answers={answers} setAnswer={setAnswer} />
                ))}
              </fieldset>
            ))}

            {/* Real visitors never see this; bots fill it in. */}
            <div className="qn-trap" aria-hidden="true">
              <label>
                Website
                <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </label>
            </div>

            <div className="qn-submit">
              <button className="button button--gold" type="submit" disabled={state.status === "loading"}>
                {state.status === "loading" ? "Sending..." : "Submit questionnaire"}
              </button>
              {state.message && <p className={`form-status form-status--${state.status}`} role="status">{state.message}</p>}
            </div>
          </form>
        )}
      </main>

      <SiteFooter />
    </>
  );
}
