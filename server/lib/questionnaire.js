import crypto from "node:crypto";
import path from "node:path";
import { OTHER, QUESTIONNAIRE, US_STATES, allQuestions, isVisible, otherKey } from "../../shared/questionnaire.js";
import { createRateLimiter } from "./auth.js";
import { contactTo, createTransporter } from "./mailer.js";
import { jsonStore } from "./store.js";

// Answers to the Golf & Social Interest Questionnaire (/questions). Each one is saved to
// server/data/questionnaire.json and emailed to the club's contact address.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const clean = (value, max) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);

// Checks the submitted answers against the question list. Returns { answers } with
// only known questions, trimmed, or { error } with a message for the visitor.
export function validateAnswers(input) {
  const raw = input && typeof input === "object" ? input : {};
  const answers = {};

  for (const q of allQuestions()) {
    if (!isVisible(q, raw)) continue;
    const label = q.label.replace(/\?$/, "");
    const value = raw[q.id];

    if (q.type === "checkbox") {
      const picked = (Array.isArray(value) ? value : []).filter((v, i, all) => all.indexOf(v) === i);
      if (picked.some((v) => v !== OTHER && !q.options.includes(v))) return { error: `Please check your answer to "${label}".` };
      if (picked.includes(OTHER) && !q.other) return { error: `Please check your answer to "${label}".` };
      if (q.required && picked.length === 0) return { error: `Please answer: ${label}.` };
      if (picked.length) answers[q.id] = picked;
    } else {
      const text = clean(value, q.max ?? 300);
      if (q.required && !text) return { error: `Please answer: ${label}.` };
      if (!text) continue;
      if (q.type === "email" && !EMAIL.test(text)) return { error: "Please enter a valid email address." };
      if (q.type === "state" && !US_STATES.includes(text)) return { error: "Please choose your state from the list." };
      if (q.type === "radio" && text !== OTHER && !q.options.includes(text)) return { error: `Please check your answer to "${label}".` };
      if (q.type === "radio" && text === OTHER && !q.other) return { error: `Please check your answer to "${label}".` };
      answers[q.id] = text;
    }

    if (q.other && (answers[q.id] === OTHER || answers[q.id]?.includes?.(OTHER))) {
      const other = clean(raw[otherKey(q.id)], 200);
      if (!other) return { error: `Please tell us more for "Other" in: ${label}.` };
      answers[otherKey(q.id)] = other;
    }
  }
  return { answers };
}

// A plain-text summary: each question followed by the answer.
export function summarize(answers) {
  const lines = [QUESTIONNAIRE.title, ""];
  for (const section of QUESTIONNAIRE.sections) {
    const rows = [];
    for (const q of section.questions) {
      const value = answers[q.id];
      if (!value || (Array.isArray(value) && !value.length)) continue;
      const shown = (Array.isArray(value) ? value : [value]).map((v) => (v === OTHER ? `Other: ${answers[otherKey(q.id)]}` : v));
      rows.push(`${q.label}`, `  ${shown.join("; ")}`);
    }
    if (rows.length) lines.push(section.title.toUpperCase(), ...rows, "");
  }
  return lines.join("\n");
}

export function createQuestionnaire(dataDir) {
  const store = jsonStore(path.join(dataDir, "questionnaire.json"), { responses: [] });
  const allow = createRateLimiter(10, 60 * 60 * 1000);

  function mountRoutes(app) {
    app.post("/api/questionnaire", async (req, res) => {
      if (!allow(req.ip)) {
        return res.status(429).json({ ok: false, error: "Too many submissions from this connection. Please try again later." });
      }
      // A hidden field real visitors never fill in; bots do. Pretend it worked.
      if (req.body?.website) return res.json({ ok: true });

      const { answers, error } = validateAnswers(req.body?.answers);
      if (error) return res.status(400).json({ ok: false, error });

      const response = { id: crypto.randomUUID(), submittedAt: new Date().toISOString(), answers };
      await store.update((data) => {
        data.responses.push(response);
      });

      const transporter = createTransporter();
      if (transporter) {
        const name = `${answers.firstName} ${answers.lastName}`;
        transporter
          .sendMail({
            to: contactTo,
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            replyTo: answers.email,
            subject: `New interest questionnaire from ${name}`,
            text: `${summarize(answers)}\nSubmitted ${response.submittedAt}\n`
          })
          .catch((err) => console.error("Failed to email questionnaire response", err));
      }

      res.json({ ok: true });
    });
  }

  return { mountRoutes };
}
