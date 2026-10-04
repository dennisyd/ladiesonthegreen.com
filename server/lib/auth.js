import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// Signed tokens (member sessions, sign-in links, admin sessions). The key comes
// from SESSION_SECRET, or is generated once and kept in server/data so sessions
// survive restarts without any setup.
function loadSecret(dataDir) {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const file = path.join(dataDir, ".session-secret");
  try {
    return fs.readFileSync(file, "utf8").trim();
  } catch {
    const secret = crypto.randomBytes(48).toString("base64url");
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(file, secret, { mode: 0o600 });
    return secret;
  }
}

export function createAuth(dataDir) {
  const secret = loadSecret(dataDir);
  const hmac = (body) => crypto.createHmac("sha256", secret).update(body).digest("base64url");

  function sign(payload, ttlSeconds) {
    const body = Buffer.from(
      JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds })
    ).toString("base64url");
    return `${body}.${hmac(body)}`;
  }

  function verify(token, type) {
    if (typeof token !== "string" || !token.includes(".")) return null;
    const [body, sig] = token.split(".");
    const expected = hmac(body);
    if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return null;
    }
    try {
      const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
      if (payload.t !== type || payload.exp < Date.now() / 1000) return null;
      return payload;
    } catch {
      return null;
    }
  }

  return { sign, verify };
}

export function readCookie(req, name) {
  const header = req.headers.cookie || "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function setCookie(req, res, name, value, maxAgeSeconds) {
  const attrs = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`
  ];
  if (req.secure) attrs.push("Secure");
  res.append("Set-Cookie", attrs.join("; "));
}

export function clearCookie(req, res, name) {
  setCookie(req, res, name, "", 0);
}

// Small in-memory limiter for login endpoints: `limit` attempts per key per window.
export function createRateLimiter(limit, windowMs) {
  const hits = new Map();
  return function allow(key) {
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.resetAt < now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    entry.count += 1;
    return entry.count <= limit;
  };
}

export function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}
