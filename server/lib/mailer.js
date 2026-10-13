import nodemailer from "nodemailer";

const smtpPort = Number(process.env.SMTP_PORT || 587);
export const contactTo = process.env.CONTACT_TO || process.env.SMTP_USER;
export const mailFrom = process.env.SMTP_FROM || process.env.SMTP_USER;

export function createTransporter() {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !contactTo) {
    return null;
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: smtpPort,
    secure: process.env.SMTP_SECURE === "true" || smtpPort === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });
}

export const mailConfigured = () => Boolean(createTransporter());

// Actually signs in to the mail server, so a wrong password shows up in the admin
// checklist instead of only when an email fails. Returns { ok, error }.
export async function checkMailLogin() {
  const transporter = createTransporter();
  if (!transporter) return { ok: false, error: "Email settings are missing." };
  try {
    await Promise.race([
      transporter.verify(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("The mail server did not answer in time.")), 10000))
    ]);
    return { ok: true, error: "" };
  } catch (error) {
    if (error.code === "EAUTH" || error.responseCode === 535) {
      return {
        ok: false,
        error: "The mail server rejected the username or password. Check SMTP_USER (the full email address) and SMTP_PASS in the server settings; put the password in quotes if it has symbols."
      };
    }
    return { ok: false, error: `Could not reach the mail server: ${error.message}` };
  } finally {
    transporter.close();
  }
}

// Member-facing email (sign-in links, reminders, announcements). Without SMTP
// configured (local development) the message is printed to the log instead.
// `from` picks the sender address (admin-written email); replies then go back
// to that address. System email leaves it out and comes from the site address.
export async function sendEmail({ to, subject, text, from }) {
  const transporter = createTransporter();
  if (!transporter) {
    console.log(`[email not configured] From: ${from || mailFrom || "(site address)"}\nTo: ${to}\nSubject: ${subject}\n\n${text}\n`);
    return { logged: true };
  }
  await transporter.sendMail({
    to,
    from: from ? `Ladies On The Green <${from}>` : mailFrom,
    replyTo: from || contactTo,
    subject,
    text
  });
  return { sent: true };
}
