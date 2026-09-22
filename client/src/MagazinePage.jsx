import React, { forwardRef, useEffect, useRef, useState } from "react";
import HTMLFlipBook from "react-pageflip";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const navItems = [
  { label: "Home", href: "/" },
  { label: "About Us", href: "/#about" },
  { label: "Events", href: "/#events" },
  { label: "Membership", href: "/#membership" },
  { label: "Magazine", href: "/magazine" }
];

const Page = forwardRef(function Page({ src, alt }, ref) {
  return (
    <div className="magazine-page" ref={ref}>
      <img src={src} alt={alt} draggable="false" />
    </div>
  );
});

export default function MagazinePage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Loading the latest issue...");
  const [title, setTitle] = useState("Ladies On The Green");
  const [pages, setPages] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const bookRef = useRef(null);

  useEffect(() => {
    document.title = "Digital Magazine | Ladies On The Green";
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const metaRes = await fetch("/api/magazine");
        const meta = await metaRes.json();

        if (!metaRes.ok) {
          throw new Error(meta.error || "No issue is available yet.");
        }
        if (cancelled) return;
        setTitle(meta.title);
        setMessage("Rendering pages...");

        const pdf = await pdfjsLib.getDocument(meta.url).promise;
        const rendered = [];

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          if (cancelled) return;
          const page = await pdf.getPage(pageNumber);
          const viewport = page.getViewport({ scale: 2 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
          rendered.push(canvas.toDataURL("image/jpeg", 0.86));
          setMessage(`Rendering pages... (${pageNumber}/${pdf.numPages})`);
        }

        if (cancelled) return;
        setPages(rendered);
        setStatus("ready");
      } catch (error) {
        if (cancelled) return;
        setStatus("error");
        setMessage(error.message || "We could not load the magazine.");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <>
      <header className="site-header" aria-label="Primary navigation">
        <a className="brand" href="/" aria-label="Ladies On The Green home">
          <img src="/ladiesonthegreen.png" alt="" />
          <span>Ladies On The Green</span>
        </a>
        <span aria-hidden="true" />
        <button className="menu-toggle" type="button" onClick={() => setMenuOpen((open) => !open)}>
          {menuOpen ? "Close" : "Menu"}
        </button>
        <nav className={menuOpen ? "is-open" : ""}>
          {navItems.map((item) => (
            <a href={item.href} key={item.href} onClick={closeMenu}>{item.label}</a>
          ))}
        </nav>
        <div className="header-actions">
          <a className="header-cta" href="/join" onClick={closeMenu}>Become A Member ↘</a>
        </div>
      </header>

      <main className="magazine-page-wrap">
        <div className="section-heading magazine-heading">
          <span className="section-kicker">Digital Magazine</span>
          <h1>{title}</h1>
        </div>

        {status !== "ready" && (
          <div className={`magazine-status magazine-status--${status}`}>
            <p>{message}</p>
          </div>
        )}

        {status === "ready" && pages.length > 0 && (
          <div className="magazine-viewer">
            <HTMLFlipBook
              ref={bookRef}
              width={520}
              height={720}
              size="stretch"
              minWidth={280}
              maxWidth={900}
              minHeight={380}
              maxHeight={1200}
              maxShadowOpacity={0.4}
              showCover={true}
              mobileScrollSupport={true}
              className="magazine-flipbook"
              onFlip={(event) => setCurrentPage(event.data)}
            >
              {pages.map((src, index) => (
                <Page key={src.slice(0, 32) + index} src={src} alt={`Page ${index + 1}`} />
              ))}
            </HTMLFlipBook>

            <div className="magazine-controls">
              <button type="button" onClick={() => bookRef.current?.pageFlip().flipPrev()}>
                ‹ Prev
              </button>
              <span>
                Page {currentPage + 1} of {pages.length}
              </span>
              <button type="button" onClick={() => bookRef.current?.pageFlip().flipNext()}>
                Next ›
              </button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
