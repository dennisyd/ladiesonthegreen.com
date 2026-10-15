import { MAGAZINE_IS_FINAL, MAGAZINE_COMING_SOON } from "../../shared/magazine.js";

export function requireFinalMagazine(_req, res, next) {
  res.setHeader("Cache-Control", "private, no-store");
  if (!MAGAZINE_IS_FINAL) {
    return res.status(423).json({ ok: false, error: MAGAZINE_COMING_SOON });
  }
  next();
}

export function magazineMetadata(readMeta) {
  return async (_req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    if (!MAGAZINE_IS_FINAL) {
      return res.json({ ok: true, comingSoon: true, message: MAGAZINE_COMING_SOON });
    }
    const meta = await readMeta();
    if (!meta) {
      return res.status(404).json({ ok: false, error: "No issue has been uploaded yet." });
    }
    res.json({ ok: true, ...meta, url: `/uploads/magazine/${meta.filename}` });
  };
}
