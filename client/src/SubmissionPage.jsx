import React, { useEffect, useRef, useState } from "react";
import { SiteHeader, SiteFooter } from "./SiteChrome.jsx";
import { US_STATES } from "../../shared/questionnaire.js";
import "./submission.css";

function ImagePicker({ label, files, onChange, max, portrait = false, disabled }) {
  const [previews, setPreviews] = useState([]);
  const input = useRef(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);
  function pick(event) {
    const selected = Array.from(event.target.files || []);
    event.target.value = "";
    if (files.length + selected.length > max) return setError(`Choose up to ${max} ${portrait ? "portrait" : "article photos"}. Remove a photo first to replace it.`);
    if (selected.some((f) => !["image/jpeg", "image/png", "image/webp"].includes(f.type) || f.size > 5 * 1024 * 1024)) return setError("Choose JPG, PNG, or WebP images, no larger than 5 MB each.");
    setError(""); onChange([...files, ...selected]);
  }
  return <div className={`submission-upload${portrait ? " submission-upload--portrait" : ""}`}>
    <span className="submission-label">{label} <span>{portrait ? "Optional" : `${files.length} / ${max}`}</span></span>
    <input ref={input} className="sr-only" tabIndex={-1} type="file" accept="image/jpeg,image/png,image/webp" multiple={max > 1} aria-label={label} onChange={pick} disabled={disabled} />
    {files.length < max && <button className="submission-upload__button" type="button" disabled={disabled} onClick={() => input.current.click()}><span aria-hidden="true">{portrait ? "◯" : "+"}</span><strong>{portrait ? "Add your portrait" : "Choose article photos"}</strong><small>JPG, PNG or WebP · Up to 5 MB each</small></button>}
    {error && <p role="alert" className="submission-error">{error}</p>}
    <div className="submission-previews">{files.map((file, index) => <figure key={`${file.name}-${index}`}><img src={previews[index]} alt={`${portrait ? "Portrait" : "Article photo"} preview ${index + 1}`} /><figcaption>{file.name}</figcaption><button type="button" disabled={disabled} aria-label={`Remove ${file.name}`} onClick={() => onChange(files.filter((_, i) => i !== index))}>Remove</button></figure>)}</div>
  </div>;
}

export default function SubmissionPage() {
  const [photos, setPhotos] = useState([]), [portrait, setPortrait] = useState([]);
  const [article, setArticle] = useState("");
  const [status, setStatus] = useState(""), [error, setError] = useState("");
  const result = useRef(null);
  useEffect(() => { document.title = "Share Your Story | Ladies On The Green"; }, []);
  useEffect(() => { if (status === "success") result.current?.focus(); }, [status]);
  async function submit(event) {
    event.preventDefault();
    const body = new FormData(event.currentTarget);
    photos.forEach((file) => body.append("photos", file));
    if (portrait[0]) body.append("portrait", portrait[0]);
    setStatus("sending"); setError("");
    try {
      const response = await fetch("/api/submissions", { method: "POST", body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Your article could not be sent. Please try again.");
      setStatus("success"); setPhotos([]); setPortrait([]);
    } catch (err) { setStatus(""); setError(err.message); }
  }
  const busy = status === "sending";
  const words = article.trim() ? article.trim().split(/\s+/).length : 0;
  return <><SiteHeader currentPath="/submission" /><main className="submission-page">
    <section className="submission-intro"><div className="submission-intro__inner"><a className="submission-back" href="/magazine">← The Magazine</a><span className="section-kicker">Voices of the collective</span><h1>Your story.<br /><em>Our next chapter.</em></h1><p>On the green and beyond, every woman has a story worth sharing. Bring your perspective, experiences, and inspiration to our magazine.</p><div className="submission-intro__note"><span aria-hidden="true">✦</span> A space for your voice. A community ready to listen.</div></div></section>
    <div className="submission-layout"><aside className="submission-aside"><span className="section-kicker">Write with us</span><h2>Let’s make<br />something meaningful.</h2><p>Golf, friendship, wellness, travel, community, and the moments that connect us. We’d love to hear your story.</p><ol><li><strong>Introduce yourself</strong><span>A few details for your contributor profile.</span></li><li><strong>Share your article</strong><span>Give it a title and tell it in your own words.</span></li><li><strong>Bring it to life</strong><span>Add up to five photos, plus an optional portrait.</span></li></ol><p className="submission-fine">Submissions are reviewed by our editorial team. Sending an article does not guarantee publication. Please share only writing and images you have permission to submit.</p></aside>
    {status === "success" ? <section className="submission-card submission-success" ref={result} tabIndex={-1}><span aria-hidden="true">✓</span><h2>Your story is in good hands.</h2><p>Thank you for contributing to Ladies on the Green. Your article and images have been received for editorial review. Our team can reach you at the email you provided.</p><a className="button button--primary" href="/magazine">Back to the magazine ↗</a></section>
    : <form className="submission-card" onSubmit={submit} aria-busy={busy}>
      <fieldset disabled={busy}><legend><span>01</span> Meet the contributor</legend><p className="submission-section-note">Tell us a little about yourself. Fields marked * are required.</p><div className="submission-fields">
        <label>First name *<input name="firstName" autoComplete="given-name" maxLength={80} required /></label><label>Last name *<input name="lastName" autoComplete="family-name" maxLength={80} required /></label>
        <label className="submission-wide">Email *<input name="email" type="email" autoComplete="email" maxLength={254} required placeholder="you@example.com" /></label>
        <label>City *<input name="city" autoComplete="address-level2" maxLength={120} required /></label><label>State *<input name="state" list="submission-states" autoComplete="address-level1" maxLength={80} required placeholder="Select or type a state" /><datalist id="submission-states">{US_STATES.map((s) => <option key={s} value={s} />)}</datalist></label>
      </div><ImagePicker label="Contributor portrait" portrait files={portrait} onChange={setPortrait} max={1} disabled={busy} /><p className="submission-help">A portrait for your byline, if you’d like. This is separate from your five article photos.</p></fieldset>
      <fieldset disabled={busy}><legend><span>02</span> Share your story</legend><label>Article title *<input name="title" maxLength={200} required placeholder="Give your story a headline" /></label><label>Your article *<textarea name="article" rows={15} maxLength={100000} required value={article} onChange={(e) => setArticle(e.target.value)} placeholder="Start your story here…" /></label><div className="submission-word-count">{words.toLocaleString()} {words === 1 ? "word" : "words"} · {article.length.toLocaleString()} / 100,000 characters</div></fieldset>
      <fieldset disabled={busy}><legend><span>03</span> Add the moments</legend><p className="submission-section-note">Photos are optional. Choose up to five images that help tell your story.</p><ImagePicker label="Article photos" files={photos} onChange={setPhotos} max={5} disabled={busy} /></fieldset>
      <label className="submission-trap" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      <div className="submission-send"><p>Your submission is shared privately with our editorial team.</p>{error && <p className="submission-error" role="alert">{error}</p>}<button className="button button--primary" disabled={busy} type="submit">{busy ? "Sending your story…" : "Submit your story ↗"}</button></div>
    </form>}</div></main><SiteFooter /></>;
}
