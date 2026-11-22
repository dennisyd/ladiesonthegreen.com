import React, { forwardRef, useEffect, useRef, useState } from "react";
import { SiteFooter, SiteHeader } from "./SiteChrome.jsx";
import HTMLFlipBook from "react-pageflip";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const Page = forwardRef(function Page({ src, number }, ref) {
  return <div className={`magazine-page magazine-page--${number % 2 === 0 ? "left" : "right"}`} ref={ref}><img src={src} alt={`Magazine page ${number}`} draggable="false" /></div>;
});

const topics = [
  ["Golf & growth", "Lessons, rounds, and fresh perspectives from women who love the game."],
  ["Travel & experiences", "Places to play, places to gather, and moments worth sharing."],
  ["Wellness & style", "Ideas for feeling good on the course and everywhere else life takes you."],
  ["Women & business", "The stories, work, and connections shaping our community."]
];

export default function MagazinePage() {
  const requestedIssue = new URLSearchParams(window.location.search).get("issue");
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Loading the magazine...");
  const [issue, setIssue] = useState(null);
  const [issues, setIssues] = useState([]);
  const [pages, setPages] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageAspect, setPageAspect] = useState(520 / 720);
  const [bookSize, setBookSize] = useState({ width: 440, height: 610, compact: false });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTurning, setIsTurning] = useState(false);
  const bookRef = useRef(null);
  const viewerRef = useRef(null);

  useEffect(() => { document.title = "The Collective Magazine | Ladies On The Green"; }, []);

  useEffect(() => {
    let cancelled = false;
    const objectUrls = [];
    async function load() {
      try {
        const metaRes = await fetch(requestedIssue ? `/api/magazine/issues/${encodeURIComponent(requestedIssue)}` : "/api/magazine", { credentials: "same-origin" });
        if (metaRes.status === 401 || metaRes.status === 403) {
          if (!cancelled) setStatus("members-only");
          return;
        }
        const meta = await metaRes.json().catch(() => ({}));
        if (!metaRes.ok) throw new Error(meta.error || "This issue could not be loaded.");
        const listRes = await fetch("/api/magazine/issues", { credentials: "same-origin" });
        if (listRes.ok) setIssues((await listRes.json()).issues || []);
        if (cancelled) return;
        if (meta.comingSoon) {
          setStatus("coming-soon");
          setMessage(meta.message);
          return;
        }
        setIssue(meta);
        setMessage("Opening the PDF...");
        const pdf = await pdfjsLib.getDocument({ url: meta.url, withCredentials: true }).promise;
        const rendered = [];
        for (let number = 1; number <= pdf.numPages; number += 1) {
          if (cancelled) return;
          const page = await pdf.getPage(number);
          const viewport = page.getViewport({ scale: 1.6 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
          const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
          canvas.width = 0; canvas.height = 0;
          if (!blob) throw new Error("A page could not be displayed.");
          const url = URL.createObjectURL(blob);
          objectUrls.push(url);
          rendered.push(url);
          if (number === 1) setPageAspect(viewport.width / viewport.height);
          if (!cancelled) setMessage(`Preparing the issue · ${number} of ${pdf.numPages} pages`);
        }
        if (cancelled) return;
        setPages(rendered);
        setStatus("ready");
      } catch (error) {
        if (!cancelled) { setStatus("error"); setMessage(error.message || "The magazine could not be loaded."); }
      }
    }
    load();
    return () => { cancelled = true; objectUrls.forEach((url) => URL.revokeObjectURL(url)); };
  }, [requestedIssue]);

  useEffect(() => {
    if (status !== "ready") return;
    function sizeBook() {
      const available = viewerRef.current?.clientWidth || window.innerWidth;
      const compact = available < 760;
      const fullscreen = document.fullscreenElement === viewerRef.current;
      const heightCap = fullscreen ? Math.max(300, window.innerHeight - 198) * pageAspect : 560;
      const maxWidth = Math.max(240, Math.min(compact ? available - 72 : (available - 140) / 2, 560, heightCap));
      const height = Math.round(maxWidth / pageAspect);
      setBookSize({ width: Math.round(maxWidth), height, compact });
    }
    sizeBook();
    window.addEventListener("resize", sizeBook);
    document.addEventListener("fullscreenchange", sizeBook);
    return () => { window.removeEventListener("resize", sizeBook); document.removeEventListener("fullscreenchange", sizeBook); };
  }, [status, pageAspect]);

  useEffect(() => {
    function updateFullscreen() { setIsFullscreen(document.fullscreenElement === viewerRef.current); }
    document.addEventListener("fullscreenchange", updateFullscreen);
    return () => document.removeEventListener("fullscreenchange", updateFullscreen);
  }, []);

  useEffect(() => {
    if (status !== "ready") return;
    function onKey(event) {
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, button")) return;
      const flip = bookRef.current?.pageFlip();
      if (event.key === "ArrowRight") flip?.flipNext();
      if (event.key === "ArrowLeft") flip?.flipPrev();
      if (event.key === "Home") flip?.turnToPage(0);
      if (event.key === "End") flip?.turnToPage(pages.length - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status, pages.length]);

  const archive = issues.filter((item) => item.status === "archived");
  const currentIssue = issues.find((item) => item.status === "published");
  const pageLabel = bookSize.compact || currentPage === 0 || currentPage === pages.length - 1
    ? `${currentPage + 1} / ${pages.length}`
    : `${currentPage + 1}–${Math.min(currentPage + 2, pages.length)} / ${pages.length}`;
  const isOpenSpread = !bookSize.compact && currentPage > 0 && currentPage < pages.length - 1;
  const stackProgress = currentPage / Math.max(1, pages.length - 1);
  const paperDepth = Math.min(22, Math.max(8, Math.ceil(pages.length / 2) * 1.5));
  const leftThickness = Math.round(1 + stackProgress * paperDepth);
  const rightThickness = Math.round(1 + (1 - stackProgress) * paperDepth);

  return <>
    <SiteHeader currentPath="/thecollective" autoHide />
    <main className="collective-magazine">
      <section className={`collective-magazine__hero${status === "ready" || status === "loading" ? " collective-magazine__hero--suppressed" : ""}`} aria-labelledby="collective-title">
        <div className="collective-magazine__hero-copy">
          <span className="section-kicker">Ladies On The Green® Presents</span>
          <h1 id="collective-title">The <em>Collective</em> Magazine</h1>
          <p className="collective-magazine__lede">Real women. Real stories. Golf, travel, wellness, business, and the everyday inspiration that connects us.</p>
          {issue?.edition && <p className="collective-magazine__edition">{issue.edition}</p>}
          {status === "members-only" && <div className="collective-magazine__hero-actions">
            <a className="button button--gold" href="/subscribe">Subscribe</a>
            <a className="button button--outline" href="/submission">Submit your story</a>
          </div>}
          {status === "members-only" && <p className="collective-magazine__member-note">Already a member? <a href="/members">Sign in to read ↗</a></p>}
        </div>
        <div className={`collective-magazine__art${pages[0] ? " collective-magazine__art--issue" : ""}`} role={pages[0] ? undefined : "img"} aria-label={pages[0] ? undefined : "The Collective Magazine cover featuring women golfers"}>
          {pages[0] && <img src={pages[0]} alt={`Cover of ${issue?.title || "The Collective Magazine"}`} />}
        </div>
      </section>

      {status !== "members-only" && <section className="collective-magazine__reader-section" aria-label="Digital issue">
        <div className="collective-magazine__section-head">
          <span className="section-kicker">Digital edition</span>
          {status === "ready" ? <h1>{issue?.title || "The Collective Magazine"}</h1> : <h2>{issue?.title || "Your next great read is on its way."}</h2>}
          {issue?.status === "archived" && <p>From the archive</p>}
        </div>
        {status !== "ready" && <div className={`magazine-status magazine-status--${status}`} role="status">
          {status === "coming-soon" ? <p>{message}</p> : <p>{message}</p>}
        </div>}
        {status === "ready" && pages.length > 0 && <div className={`collective-reader${isFullscreen ? " is-fullscreen" : ""}`} ref={viewerRef}>
          <div className="collective-reader__topbar">
            <div className="collective-reader__brand"><img src="/ladiesonthegreen.png?v=2" alt="" /><span>The Collective</span></div>
            <div className="collective-reader__issue"><small>{issue.edition || "Digital issue"}</small><strong>{issue.title}</strong></div>
            <button type="button" onClick={() => isFullscreen ? document.exitFullscreen() : viewerRef.current?.requestFullscreen()} aria-label={isFullscreen ? "Exit full screen" : "Read full screen"}>{isFullscreen ? "Exit full screen" : "Full screen"}</button>
          </div>
          <div className="collective-reader__canvas">
            <button className="collective-reader__arrow" type="button" onClick={() => bookRef.current?.pageFlip().flipPrev()} disabled={currentPage === 0} aria-label="Previous page">‹</button>
            <div className={`collective-reader__stage${isTurning ? " collective-reader__stage--turning" : ""}`} style={{ width: bookSize.width * (bookSize.compact ? 1 : 2), height: bookSize.height, transform: bookSize.compact ? undefined : `translateX(${currentPage === 0 ? -bookSize.width / 2 : currentPage >= pages.length - 1 ? bookSize.width / 2 : 0}px)` }}>
              <div className={`collective-reader__paper-stack${bookSize.compact ? " collective-reader__paper-stack--compact" : ""}`} aria-hidden="true" style={{ width: bookSize.width * (bookSize.compact ? 1 : 2), height: bookSize.height }}>
                {(isOpenSpread || (!bookSize.compact && currentPage >= pages.length - 1)) && <div className="collective-reader__paper-half collective-reader__paper-half--left" style={{ "--stack-depth": `${leftThickness}px` }}><span /></div>}
                {(isOpenSpread || (!bookSize.compact && currentPage === 0)) && <div className="collective-reader__paper-half collective-reader__paper-half--right" style={{ "--stack-depth": `${rightThickness}px` }}><span /></div>}
                {bookSize.compact && <div className="collective-reader__paper-half collective-reader__paper-half--single" style={{ "--stack-depth": `${Math.max(leftThickness, rightThickness)}px`, "--stack-left": `${leftThickness}px`, "--stack-right": `${rightThickness}px` }}><span /><span /></div>}
              </div>
              <HTMLFlipBook key={`${bookSize.width}-${bookSize.compact}`} ref={bookRef} width={bookSize.width} height={bookSize.height} startPage={currentPage} size="fixed" showCover usePortrait={bookSize.compact} mobileScrollSupport={false} maxShadowOpacity={0.36} drawShadow flippingTime={820} className="magazine-flipbook" onFlip={(event) => setCurrentPage(event.data)} onChangeState={(event) => setIsTurning(event.data === "flipping" || event.data === "user_fold")}>
                {pages.map((src, index) => <Page key={index} src={src} number={index + 1} />)}
              </HTMLFlipBook>
              {isOpenSpread && <span className="collective-reader__gutter" aria-hidden="true" />}
            </div>
            <button className="collective-reader__arrow" type="button" onClick={() => bookRef.current?.pageFlip().flipNext()} disabled={currentPage >= pages.length - 1} aria-label="Next page">›</button>
          </div>
          <div className="collective-reader__toolbar">
            <span aria-live="polite">{pageLabel}</span>
            <input type="range" min="0" max={pages.length - 1} value={currentPage} onChange={(event) => bookRef.current?.pageFlip().turnToPage(Number(event.target.value))} aria-label="Magazine page" />
          </div>
        </div>}
        {issue?.status === "archived" && currentIssue && <p className="collective-magazine__current-link"><a href="/thecollective">Read the latest issue ↗</a></p>}
      </section>}

      {status !== "members-only" && archive.length > 0 && <section className="collective-magazine__archive" aria-labelledby="collective-archive-title">
        <div className="collective-magazine__section-head"><span className="section-kicker">The library</span><h2 id="collective-archive-title">Past editions</h2></div>
        <div className="collective-magazine__archive-grid">
          {archive.map((item) => <a key={item.id} href={`/thecollective?issue=${encodeURIComponent(item.id)}`} className={item.id === issue?.id ? "is-current" : ""}>
            <span>{item.edition || "The Collective"}</span><strong>{item.title}</strong><span>Read this issue ↗</span>
          </a>)}
        </div>
      </section>}

      <section className="collective-magazine__topics" aria-labelledby="collective-topics-title">
        <div className="collective-magazine__section-head"><span className="section-kicker">Inside the Collective</span><h2 id="collective-topics-title">A magazine for every part of the journey.</h2></div>
        <div className="collective-magazine__topics-grid">
          {topics.map(([title, description], index) => <article key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{description}</p></article>)}
        </div>
      </section>
      <section className="collective-magazine__cta"><span className="section-kicker">Your story belongs here</span><h2>Stories grow stronger when we share them.</h2><p>Have a perspective, experience, or idea for a future issue?</p><a className="button button--gold" href="/submission">Submit your story ↗</a></section>
    </main>
    <SiteFooter />
  </>;
}
