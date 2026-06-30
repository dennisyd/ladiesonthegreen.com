import express from "express";
import nodemailer from "nodemailer";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = process.env.PORT || 3000;
const smtpPort = Number(process.env.SMTP_PORT || 587);
const contactTo = process.env.CONTACT_TO || process.env.SMTP_USER;

app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));

function createTransporter() {
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

app.post("/api/contact", async (req, res) => {
  const { name, email, interest, message } = req.body ?? {};

  if (!name || !email || !message) {
    return res.status(400).json({ ok: false, error: "Missing required fields." });
  }

  const transporter = createTransporter();
  const selectedInterest = interest || "General membership";

  console.log("New Ladies On The Green inquiry", {
    name,
    email,
    interest: selectedInterest,
    message,
    receivedAt: new Date().toISOString()
  });

  if (!transporter) {
    return res.status(500).json({
      ok: false,
      error: "Email is not configured yet. Please contact us directly at hello@ladiesonthegreen.com."
    });
  }

  try {
    await transporter.sendMail({
      to: contactTo,
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      replyTo: email,
      subject: `New Ladies On The Green inquiry from ${name}`,
      text: [
        "New Ladies On The Green inquiry",
        "",
        `Name: ${name}`,
        `Email: ${email}`,
        `Interest: ${selectedInterest}`,
        "",
        "Message:",
        message
      ].join("\n")
    });
  } catch (error) {
    console.error("Failed to send contact inquiry", error);
    return res.status(500).json({
      ok: false,
      error: "We could not send your inquiry. Please email hello@ladiesonthegreen.com directly."
    });
  }

  return res.status(200).json({
    ok: true,
    message: "Thanks for reaching out. We will be in touch soon."
  });
});

const clientDistPath = path.join(__dirname, "..", "client", "dist");

app.use(
  express.static(clientDistPath, {
    maxAge: "1d",
    setHeaders(res, filePath) {
      if (filePath.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-cache");
      }
    }
  })
);

app.use((_req, res) => {
  res.sendFile(path.join(clientDistPath, "index.html"));
});

app.listen(port, () => {
  console.log(`Ladies On The Green is running on port ${port}`);
});
