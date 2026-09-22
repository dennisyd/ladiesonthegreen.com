import express from "express";
import nodemailer from "nodemailer";
import multer from "multer";
import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
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

app.post("/api/membership", async (req, res) => {
  const { email, name, address, address2, city, state, zip, country, phone } = req.body ?? {};

  if (!email || !name || !address || !city || !state || !zip) {
    return res.status(400).json({ ok: false, error: "Please complete all required fields." });
  }

  console.log("New Ladies On The Green founding membership application", {
    name,
    email,
    phone,
    address,
    address2,
    city,
    state,
    zip,
    country,
    receivedAt: new Date().toISOString()
  });

  const transporter = createTransporter();

  if (!transporter) {
    return res.status(500).json({
      ok: false,
      error: "Sign-up is not available right now. Please contact us at hello@ladiesonthegreen.com."
    });
  }

  try {
    await transporter.sendMail({
      to: contactTo,
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      replyTo: email,
      subject: `New founding membership application: ${name}`,
      text: [
        "New founding membership application ($89 / year)",
        "",
        `Name: ${name}`,
        `Email: ${email}`,
        `Phone: ${phone || "-"}`,
        "",
        "Address:",
        address,
        address2 || "",
        `${city}, ${state} ${zip}`,
        country || ""
      ].join("\n")
    });
  } catch (error) {
    console.error("Failed to send membership application", error);
    return res.status(500).json({
      ok: false,
      error: "We could not save your details. Please email hello@ladiesonthegreen.com directly."
    });
  }

  return res.status(200).json({
    ok: true,
    message: "Thank you! Your details are in. We will email you shortly with your payment link."
  });
});

// --- Digital magazine (PDF flipbook) ---
const uploadsDir = path.join(__dirname, "uploads", "magazine");
const magazineMetaPath = path.join(__dirname, "data", "magazine.json");
const magazineAdminPassword = process.env.MAGAZINE_ADMIN_PASSWORD;

await fs.mkdir(uploadsDir, { recursive: true });
await fs.mkdir(path.dirname(magazineMetaPath), { recursive: true });

async function readMagazineMeta() {
  try {
    return JSON.parse(await fs.readFile(magazineMetaPath, "utf8"));
  } catch {
    return null;
  }
}

async function writeMagazineMeta(meta) {
  await fs.writeFile(magazineMetaPath, JSON.stringify(meta, null, 2));
}

const magazineUpload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename(_req, file, cb) {
      cb(null, `${Date.now()}-${crypto.randomUUID()}.pdf`);
    }
  }),
  limits: { fileSize: 80 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    cb(null, file.mimetype === "application/pdf");
  }
});

app.get("/api/magazine", async (_req, res) => {
  const meta = await readMagazineMeta();
  if (!meta) {
    return res.status(404).json({ ok: false, error: "No issue has been uploaded yet." });
  }
  res.json({ ok: true, ...meta, url: `/uploads/magazine/${meta.filename}` });
});

app.post("/api/magazine/upload", (req, res) => {
  magazineUpload.single("file")(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ ok: false, error: err.message || "Upload failed." });
    }

    if (!magazineAdminPassword) {
      if (req.file) await fs.unlink(req.file.path).catch(() => {});
      return res.status(500).json({
        ok: false,
        error: "Uploading is not configured yet. Set MAGAZINE_ADMIN_PASSWORD on the server."
      });
    }

    if (req.body.password !== magazineAdminPassword) {
      if (req.file) await fs.unlink(req.file.path).catch(() => {});
      return res.status(401).json({ ok: false, error: "Incorrect password." });
    }

    if (!req.file) {
      return res.status(400).json({ ok: false, error: "Please choose a PDF file." });
    }

    const previous = await readMagazineMeta();
    const meta = {
      filename: req.file.filename,
      title: (req.body.title || "").trim() || "Ladies On The Green",
      originalName: req.file.originalname,
      sizeBytes: req.file.size,
      uploadedAt: new Date().toISOString()
    };
    await writeMagazineMeta(meta);

    if (previous?.filename && previous.filename !== meta.filename) {
      await fs.unlink(path.join(uploadsDir, previous.filename)).catch(() => {});
    }

    res.json({ ok: true, ...meta, url: `/uploads/magazine/${meta.filename}` });
  });
});

app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), {
    maxAge: "1h",
    setHeaders(res) {
      res.setHeader("Content-Disposition", "inline");
    }
  })
);

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
