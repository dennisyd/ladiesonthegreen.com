import express from "express";
import helmet from "helmet";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Optional settings file at the repo root (gitignored). Variables already set in
// the environment (e.g. by PM2) win over the file.
const envFile = path.join(__dirname, "..", ".env");
if (existsSync(envFile) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envFile);
}

// Imported after the .env file is loaded: these read process.env at load time.
const { contactTo, createTransporter } = await import("./lib/mailer.js");
const { createMembership } = await import("./members.js");
const { createSiteEvents } = await import("./lib/site-events.js");
const { createQuestionnaire } = await import("./lib/questionnaire.js");
const { createShop } = await import("./shop.js");
const { mountSubmissions } = await import("./lib/submissions.js");
const { mountMagazineList } = await import("./lib/magazine-list.js");
const { createMagazineIssues } = await import("./lib/magazine-issues.js");
const { membershipRate, membershipTiers } = await import("../shared/membership.js");

const app = express();
const port = process.env.PORT || 3000;
const membership = createMembership(path.join(__dirname, "data"));
await membership.init();
const shop = createShop(path.join(__dirname, "data"), {
  stripe: membership.stripe,
  requireAdmin: membership.requireAdmin
});
membership.addWebhookHandler(shop.handleEvent);

app.disable("x-powered-by");

// Security headers. The CSP only lets the page load its own scripts; images may come
// from any https address (admin-pasted photo links), and checkout forms may go to Stripe.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        mediaSrc: ["'self'", "blob:"],
        fontSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        workerSrc: ["'self'", "blob:"],
        frameAncestors: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'", "https://buy.stripe.com", "https://checkout.stripe.com"]
      }
    },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    hsts: { maxAge: 15552000, includeSubDomains: false },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false // emails and link previews load our images from other sites
  })
);
app.set("trust proxy", 1); // behind Nginx: real client IP + https detection for secure cookies
membership.mountWebhook(app); // needs the raw body, so before express.json
app.use(express.json({ limit: "32kb" }));

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
  const { email, name, address, address2, city, state, zip, country, phone, membershipTier = "social" } = req.body ?? {};

  if (!email || !name || !address || !city || !state || !zip) {
    return res.status(400).json({ ok: false, error: "Please complete all required fields." });
  }

  if (!Object.hasOwn(membershipTiers, membershipTier)) {
    return res.status(400).json({ ok: false, error: "Please choose a valid membership." });
  }
  const rate = membershipRate(membershipTier);

  try {
    await membership.recordApplication({ email, name, address, address2, city, state, zip, country, phone, membershipTier });
  } catch (error) {
    console.error("Failed to save membership application", error);
  }

  console.log("New Ladies On The Green membership application", {
    membershipTier,
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
      subject: `New ${rate.name} application: ${name}`,
      text: [
        `New ${rate.name} application ($${rate.amount} / year)`,
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
    message: "Thank you! Your details are saved. Continue to secure payment to complete your membership."
  });
});

// Magazine issues are managed in the main admin dashboard. New PDFs stay in
// draft until an admin explicitly publishes them; older editions are retained.
const magazineIssues = createMagazineIssues(path.join(__dirname, "data"), {
  requireAdmin: membership.requireAdmin,
  requireMember: membership.requireMember
});
await magazineIssues.ready;
magazineIssues.mountRoutes(app);

membership.mountRoutes(app);
shop.mountRoutes(app);
mountSubmissions(app, path.join(__dirname, "data"), membership.requireAdmin);
mountMagazineList(app, path.join(__dirname, "data"), membership.requireAdmin);
createSiteEvents(path.join(__dirname, "data"), { requireAdmin: membership.requireAdmin }).mountRoutes(app);
createQuestionnaire(path.join(__dirname, "data"), { requireAdmin: membership.requireAdmin }).mountRoutes(app);

app.use("/api", (_req, res) => {
  res.status(404).json({ ok: false, error: "Not found." });
});

app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), {
    maxAge: "1h",
    setHeaders(res, filePath) {
      res.setHeader("Content-Disposition", "inline");
      if (filePath.startsWith(path.join(__dirname, "uploads", "magazine") + path.sep)) {
        res.setHeader("Cache-Control", "private, no-store");
      }
    }
  })
);

const clientDistPath = path.join(__dirname, "..", "client", "dist");

app.get("/magazine", (req, res) => {
  const query = req.originalUrl.includes("?") ? req.originalUrl.slice(req.originalUrl.indexOf("?")) : "";
  res.redirect(301, `/thecollective${query}`);
});

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

app.use((error, req, res, next) => {
  console.error("Request failed", req.method, req.path, error);
  if (res.headersSent || !req.path.startsWith("/api")) return next(error);
  res.status(500).json({ ok: false, error: "Something went wrong. Please try again." });
});

app.listen(port, () => {
  console.log(`Ladies On The Green is running on port ${port}`);
});
