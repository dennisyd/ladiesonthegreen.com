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

// Member-facing email (sign-in links, reminders, announcements). Without SMTP
// configured (local development) the message is printed to the log instead.
export async function sendEmail({ to, subject, text }) {
  const transporter = createTransporter();
  if (!transporter) {
    console.log(`[email not configured] To: ${to}\nSubject: ${subject}\n\n${text}\n`);
    return { logged: true };
  }
  await transporter.sendMail({ to, from: mailFrom, replyTo: contactTo, subject, text });
  return { sent: true };
}
