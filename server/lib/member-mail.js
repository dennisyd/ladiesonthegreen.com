import path from "node:path";
import { mailFrom, sendEmail } from "./mailer.js";
import { normalizeEmail } from "./member-model.js";
import { jsonStore } from "./store.js";

// Admin-written email to members: one-off messages from the Members tab and the
// automatic welcome email. Sender addresses and the welcome template are edited
// in /admin → Settings and stored in mail-settings.json.

const WELCOME_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

const DEFAULT_WELCOME = {
  enabled: false,
  from: "",
  subject: "Welcome to Ladies On The Green, {first_name}!",
  body: [
    "Hi {first_name},",
    "",
    "Welcome to Ladies On The Green! Your membership is active, and we are so glad you are here.",
    "",
    "Your member portal is ready: {portal_link}",
    "Enter this email address there and we will send you a secure sign-in link (no password needed). Inside you will find member offers, upcoming member events, and the member directory.",
    "",
    "Your membership renews on {renewal_date}.",
    "",
    "Questions? Just reply to this email.",
    "",
    "Join. Connect. Tee Off.",
    "Ladies On The Green"
  ].join("\n")
};

export const PLACEHOLDERS = [
  ["{first_name}", "Member's first name"],
  ["{name}", "Member's full name"],
  ["{portal_link}", "Link to the member portal"],
  ["{renewal_date}", "Date her membership renews"]
];

const clean = (value, max) => String(value ?? "").trim().slice(0, max);
const firstName = (name) => String(name || "").trim().split(/\s+/)[0] || "there";
const longDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" }) : "your renewal date";

export function createMemberMail(dataDir, { members, siteUrl }) {
  const store = jsonStore(path.join(dataDir, "mail-settings.json"), { senders: [], welcome: DEFAULT_WELCOME });

  // You can only send as addresses on the site's own mail domain: the mail
  // server signs for that domain, and anything else would look forged.
  const domain = (mailFrom || "").split("@")[1]?.toLowerCase() || "";
  const allowedAddress = (email) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && (!domain || email.endsWith(`@${domain}`));

  async function settings() {
    const data = await store.read();
    const senders = [...new Set([normalizeEmail(mailFrom), ...data.senders].filter(Boolean))];
    const welcome = { ...DEFAULT_WELCOME, ...data.welcome };
    if (!senders.includes(welcome.from)) welcome.from = senders[0] || "";
    return { senders, welcome };
  }

  function render(template, member) {
    const values = {
      "{first_name}": firstName(member.name),
      "{name}": member.name || "",
      "{portal_link}": `${siteUrl()}/members`,
      "{renewal_date}": longDate(member.paidThrough)
    };
    return template.replace(/\{[a-z_]+\}/g, (token) => (token in values ? values[token] : token));
  }

  async function sendWelcome(member, to = member.email) {
    const { welcome } = await settings();
    await sendEmail({
      to,
      from: welcome.from || undefined,
      subject: render(welcome.subject, member),
      text: render(welcome.body, member)
    });
  }

  // Called whenever someone becomes an active member. Sends once per member,
  // and only for fresh activations so a Stripe backfill never emails old members.
  async function sendWelcomeIfDue(memberId) {
    try {
      const { welcome } = await settings();
      if (!welcome.enabled) return false;
      const member = (await members.read()).members.find((m) => m.id === memberId);
      if (!member || member.status !== "active" || member.welcomeSentAt) return false;
      if (!member.activatedAt || Date.now() - Date.parse(member.activatedAt) > WELCOME_WINDOW_MS) return false;
      await sendWelcome(member);
      await members.update((data) => {
        const m = data.members.find((x) => x.id === memberId);
        if (m) m.welcomeSentAt = new Date().toISOString();
      });
      return true;
    } catch (error) {
      console.error("Welcome email failed", memberId, error);
      return false;
    }
  }

  function mountRoutes(app, requireAdmin) {
    app.get("/api/admin/mail", requireAdmin, async (_req, res) => {
      res.json({ ok: true, ...(await settings()), domain, defaultSender: normalizeEmail(mailFrom), placeholders: PLACEHOLDERS });
    });

    app.put("/api/admin/mail", requireAdmin, async (req, res) => {
      const body = req.body || {};
      const current = await settings();

      let senders = current.senders;
      if (Array.isArray(body.senders)) {
        senders = [...new Set(body.senders.map(normalizeEmail).filter(Boolean))];
        const bad = senders.find((email) => !allowedAddress(email));
        if (bad) {
          return res.status(400).json({
            ok: false,
            error: domain ? `${bad} can't be used. Sender addresses must end in @${domain}.` : `${bad} isn't a valid email address.`
          });
        }
      }

      let welcome = current.welcome;
      if (body.welcome) {
        welcome = {
          enabled: Boolean(body.welcome.enabled),
          from: normalizeEmail(body.welcome.from),
          subject: clean(body.welcome.subject, 200),
          body: clean(body.welcome.body, 10000)
        };
        if (!welcome.subject || !welcome.body) {
          return res.status(400).json({ ok: false, error: "The welcome email needs a subject and a message." });
        }
      }

      const defaultSender = normalizeEmail(mailFrom);
      await store.update((data) => {
        data.senders = senders.filter((email) => email !== defaultSender);
        data.welcome = welcome;
      });
      res.json({ ok: true, ...(await settings()) });
    });

    // Preview the welcome email in a real inbox, filled in with sample details.
    app.post("/api/admin/mail/welcome-test", requireAdmin, async (req, res) => {
      const to = normalizeEmail(req.body?.to);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return res.status(400).json({ ok: false, error: "Enter the email address to send the test to." });
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      try {
        await sendWelcome({ name: "Test Member", paidThrough: nextYear.toISOString() }, to);
        res.json({ ok: true });
      } catch (error) {
        console.error("Welcome test failed", error);
        res.status(500).json({ ok: false, error: `The test could not be sent: ${error.message}` });
      }
    });

    app.post("/api/admin/members/:id/email", requireAdmin, async (req, res) => {
      const subject = clean(req.body?.subject, 200);
      const message = clean(req.body?.message, 10000);
      const from = normalizeEmail(req.body?.from);
      if (!subject || !message) return res.status(400).json({ ok: false, error: "Add a subject and a message." });
      const { senders } = await settings();
      if (!senders.includes(from)) return res.status(400).json({ ok: false, error: "Choose a sender address from the list." });
      const member = (await members.read()).members.find((m) => m.id === req.params.id);
      if (!member) return res.status(404).json({ ok: false, error: "Member not found." });

      try {
        await sendEmail({ to: member.email, from, subject: render(subject, member), text: render(message, member) });
      } catch (error) {
        console.error("Member email failed", member.email, error);
        return res.status(500).json({ ok: false, error: `The email could not be sent: ${error.message}` });
      }
      await members.update((data) => {
        const m = data.members.find((x) => x.id === member.id);
        if (m) m.lastEmailedAt = new Date().toISOString();
      });
      res.json({ ok: true });
    });
  }

  return { mountRoutes, sendWelcomeIfDue };
}
