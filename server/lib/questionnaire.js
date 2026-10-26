import crypto from "node:crypto";
import path from "node:path";
import { OTHER, QUESTIONNAIRE, US_STATES, allQuestions, isValidEmail, isVisible, otherKey } from "../../shared/questionnaire.js";
import { createRateLimiter } from "./auth.js";
import { contactTo, createTransporter } from "./mailer.js";
import { jsonStore } from "./store.js";

// Answers to the Golf & Social Interest Questionnaire (/questions). Each one is saved to
// server/data/questionnaire.json and emailed to the club's contact address.

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
      if (q.type === "email" && !isValidEmail(text)) return { error: "Please enter a valid email address, like name@example.com." };
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

// One answer as text, with "Other" replaced by what the person typed.
export function displayAnswer(question, answers) {
  const value = answers[question.id];
  if (!value || (Array.isArray(value) && !value.length)) return "";
  return (Array.isArray(value) ? value : [value]).map((v) => (v === OTHER ? `Other: ${answers[otherKey(question.id)]}` : v)).join("; ");
}

// A plain-text summary: each question followed by the answer.
export function summarize(answers) {
  const lines = [QUESTIONNAIRE.title, ""];
  for (const section of QUESTIONNAIRE.sections) {
    const rows = [];
    for (const q of section.questions) {
      const shown = displayAnswer(q, answers);
      if (shown) rows.push(`${q.label}`, `  ${shown}`);
    }
    if (rows.length) lines.push(section.title.toUpperCase(), ...rows, "");
  }
  return lines.join("\n");
}

// Who gets the emailed copy: the club's contact address, Martine, and anyone listed in
// QUESTIONNAIRE_NOTIFY_TO (comma separated) in the server's .env, without repeats.
const ALWAYS_NOTIFY = ["martine.dennis@gmail.com"];

export function notifyRecipients(extra = process.env.QUESTIONNAIRE_NOTIFY_TO || "") {
  const list = [contactTo, ...ALWAYS_NOTIFY, ...extra.split(",")].map((e) => String(e || "").trim()).filter(Boolean);
  return list.filter((e, i) => list.findIndex((x) => x.toLowerCase() === e.toLowerCase()) === i);
}

export function createQuestionnaire(dataDir, { requireAdmin }) {
  const store = jsonStore(path.join(dataDir, "questionnaire.json"), { responses: [] });
  const allow = createRateLimiter(10, 60 * 60 * 1000);

  const csvCell = (value) => {
    const text = value == null ? "" : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  function mountRoutes(app) {
    // Admin: every response, newest first.
    app.get("/api/admin/questionnaire", requireAdmin, async (_req, res) => {
      const { responses } = await store.read();
      res.json({ ok: true, responses: responses.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)) });
    });

    app.get("/api/admin/questionnaire.csv", requireAdmin, async (_req, res) => {
      const { responses } = await store.read();
      const questions = allQuestions();
      const rows = [
        ["Submitted", ...questions.map((q) => q.label)],
        ...responses
          .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
          .map((r) => [r.submittedAt, ...questions.map((q) => displayAnswer(q, r.answers))])
      ];
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="lotg-questionnaire-${new Date().toISOString().slice(0, 10)}.csv"`);
      res.send("﻿" + rows.map((line) => line.map(csvCell).join(",")).join("\r\n"));
    });

    app.delete("/api/admin/questionnaire/:id", requireAdmin, async (req, res) => {
      const removed = await store.update((data) => {
        const before = data.responses.length;
        data.responses = data.responses.filter((r) => r.id !== req.params.id);
        return data.responses.length < before;
      });
      if (!removed) return res.status(404).json({ ok: false, error: "Response not found." });
      res.json({ ok: true });
    });

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
            to: notifyRecipients(),
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
