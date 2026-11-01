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
  const [articleMode, setArticleMode] = useState("text"), [document, setDocument] = useState(null);
  const [documentError, setDocumentError] = useState("");
  const [status, setStatus] = useState(""), [error, setError] = useState("");
  const result = useRef(null);
  useEffect(() => { window.document.title = "Her Story. Our Collective. | Ladies On The Green"; }, []);
  useEffect(() => { if (status === "success") result.current?.focus(); }, [status]);
  async function submit(event) {
    event.preventDefault();
    const body = new FormData(event.currentTarget);
    if (articleMode === "upload") {
      if (!document) { setDocumentError("Choose a Word or PDF article to upload."); return; }
      body.append("document", document);
    }
    photos.forEach((file) => body.append("photos", file));
    if (portrait[0]) body.append("portrait", portrait[0]);
    setStatus("sending"); setError("");
    try {
      const response = await fetch("/api/submissions", { method: "POST", body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Your article could not be sent. Please try again.");
      setStatus("success"); setPhotos([]); setPortrait([]); setDocument(null);
    } catch (err) { setStatus(""); setError(err.message); }
  }
  const busy = status === "sending";
  const words = article.trim() ? article.trim().split(/\s+/).length : 0;
  function chooseDocument(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!/\.(docx?|pdf)$/i.test(file.name) || file.size > 10 * 1024 * 1024) {
      setDocumentError("Choose a Word (.doc or .docx) or PDF file, no larger than 10 MB."); return;
    }
    setDocument(file); setDocumentError("");
  }
  return <><SiteHeader currentPath="/submission" /><main className="submission-page">
    <section className="submission-intro submission-intro--collective"><div className="submission-intro__inner"><span className="section-kicker">The Collective | Magazine</span><h1>Her Story. Our Collective.</h1><p className="submission-intro__tagline">Your voice. Your journey. Your story.</p><blockquote>“You don’t have to be famous to have an extraordinary story. Sometimes the most inspiring woman is the one standing right beside us.”</blockquote><p className="submission-intro__welcome">The Collective celebrates women on and beyond the fairway. Whether you’re a seasoned golfer, just discovering the game, or making an impact in your community, we invite you to share your story.</p></div></section>
    <div className="submission-layout"><aside className="submission-aside"><span className="section-kicker">Write with us</span><h2>Let’s make<br />something meaningful.</h2><p>Golf, friendship, wellness, travel, community, and the moments that connect us. We’d love to hear your story.</p><ol><li><strong>Introduce yourself</strong><span>A few details for your contributor profile.</span></li><li><strong>Share your article</strong><span>Give it a title and tell it in your own words.</span></li><li><strong>Bring it to life</strong><span>Add up to three photos, plus an optional portrait.</span></li></ol><p className="submission-fine">Submissions are reviewed by our editorial team. Sending an article does not guarantee publication. Please share only writing and images you have permission to submit.</p></aside>
    {status === "success" ? <section className="submission-card submission-success" ref={result} tabIndex={-1}><span aria-hidden="true">✓</span><h2>Your story is in good hands.</h2><p>Thank you for contributing to Ladies on the Green. Your article and images have been received for editorial review. Our team can reach you at the email you provided.</p><a className="button button--primary" href="/magazine">Back to the magazine ↗</a></section>
    : <form className="submission-card" onSubmit={submit} aria-busy={busy}>
      <fieldset disabled={busy}><legend><span>01</span> Meet the contributor</legend><p className="submission-section-note">Tell us a little about yourself. Fields marked * are required.</p><div className="submission-fields">
        <label>First name *<input name="firstName" autoComplete="given-name" maxLength={80} required /></label><label>Last name *<input name="lastName" autoComplete="family-name" maxLength={80} required /></label>
        <label className="submission-wide">Email *<input name="email" type="email" autoComplete="email" maxLength={254} required placeholder="you@example.com" /></label>
        <label>City *<input name="city" autoComplete="address-level2" maxLength={120} required /></label><label>State *<input name="state" list="submission-states" autoComplete="address-level1" maxLength={80} required placeholder="Select or type a state" /><datalist id="submission-states">{US_STATES.map((s) => <option key={s} value={s} />)}</datalist></label>
        <label className="submission-wide">Profession, Business, or Passion<input name="profession" maxLength={200} placeholder="Tell us what you do or what inspires you" /></label>
      </div><ImagePicker label="Contributor portrait" portrait files={portrait} onChange={setPortrait} max={1} disabled={busy} /><p className="submission-help">A portrait for your story, if you’d like. This is separate from your three article photos.</p></fieldset>
      <fieldset disabled={busy}><legend><span>02</span> Share your story</legend><label>Article title *<input name="title" maxLength={200} required placeholder="Give your story a headline" /></label>
        <div className="submission-article-options" role="group" aria-label="How would you like to submit your article?">
          <button type="button" aria-pressed={articleMode === "text"} onClick={() => { setArticleMode("text"); setDocumentError(""); }}>Write or paste article</button>
          <button type="button" aria-pressed={articleMode === "upload"} onClick={() => setArticleMode("upload")}>Upload Word or PDF</button>
        </div>
        {articleMode === "text" ? <><label>Your article *<textarea name="article" rows={15} maxLength={100000} required value={article} onChange={(e) => setArticle(e.target.value)} placeholder="Start your story here…" /></label><div className="submission-word-count">{words.toLocaleString()} {words === 1 ? "word" : "words"} · {article.length.toLocaleString()} / 100,000 characters</div></>
        : <div className="submission-document"><label>Article file *<input type="file" accept=".doc,.docx,.pdf,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={chooseDocument} /></label><p className="submission-help">Word (.doc or .docx) or PDF · Maximum 10 MB</p>{document && <div className="submission-document__selected"><strong>{document.name}</strong><span>{(document.size / 1024 / 1024).toFixed(2)} MB</span><button type="button" onClick={() => setDocument(null)}>Remove file</button></div>}{documentError && <p role="alert" className="submission-error">{documentError}</p>}</div>}
      </fieldset>
      <fieldset disabled={busy}><legend><span>03</span> Add the moments</legend><p className="submission-section-note">Photos are optional. Choose up to three images that help tell your story.</p><ImagePicker label="Article photos" files={photos} onChange={setPhotos} max={3} disabled={busy} /></fieldset>
      <label className="submission-trap" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      <div className="submission-send"><p>Your submission is shared privately with our editorial team.</p>{error && <p className="submission-error" role="alert">{error}</p>}<button className="button button--primary" disabled={busy} type="submit">{busy ? "Sending your story…" : "Submit your story ↗"}</button></div>
    </form>}</div></main><SiteFooter /></>;
}
