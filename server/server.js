import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = process.env.PORT || 3000;

app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));

app.post("/api/contact", (req, res) => {
  const { name, email, interest, message } = req.body ?? {};

  if (!name || !email || !message) {
    return res.status(400).json({ ok: false, error: "Missing required fields." });
  }

  console.log("New Ladies On The Green inquiry", {
    name,
    email,
    interest: interest || "General membership",
    message,
    receivedAt: new Date().toISOString()
  });

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
