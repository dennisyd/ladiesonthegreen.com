import React, { useEffect, useState } from "react";

export default function MagazineAdminPage() {
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [current, setCurrent] = useState(null);

  useEffect(() => {
    document.title = "Magazine Admin | Ladies On The Green";
    fetch("/api/magazine")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) setCurrent(data);
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const file = formData.get("file");

    if (!file || file.type !== "application/pdf") {
      setStatus("error");
      setMessage("Please choose a PDF file.");
      return;
    }

    setStatus("loading");
    setMessage("Uploading...");

    try {
      const response = await fetch("/api/magazine/upload", {
        method: "POST",
        body: formData
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Upload failed.");
      }

      setCurrent(data);
      setStatus("success");
      setMessage(`"${data.title}" is now live on /magazine.`);
      form.reset();
    } catch (error) {
      setStatus("error");
      setMessage(error.message || "Upload failed. Please try again.");
    }
  }

  return (
    <main className="magazine-admin">
      <div className="magazine-admin__card">
        <span className="section-kicker">Ladies On The Green</span>
        <h1>Magazine Upload</h1>
        <p>
          Upload a PDF to replace the issue currently shown at{" "}
          <a href="/magazine">/magazine</a>. Only one issue is live at a time.
        </p>

        {current && (
          <p className="magazine-admin__current">
            Current issue: <strong>{current.title}</strong> &middot; uploaded{" "}
            {new Date(current.uploadedAt).toLocaleString()}
          </p>
        )}

        <form onSubmit={handleSubmit}>
          <label>
            Admin password
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <label>
            Issue title
            <input name="title" type="text" placeholder="e.g. Fall 2026" />
          </label>
          <label>
            PDF file
            <input name="file" type="file" accept="application/pdf" required />
          </label>
          <button type="submit" disabled={status === "loading"}>
            {status === "loading" ? "Uploading..." : "Upload issue"}
          </button>
          <p className={`form-status form-status--${status}`} role="status">
            {message}
          </p>
        </form>
      </div>
    </main>
  );
}
