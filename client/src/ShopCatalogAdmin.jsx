import React, { useEffect, useState } from "react";
import { api } from "./api.js";

const blank = () => ({ name: "", price: "", stock: "", images: [], tagline: "", description: "", details: "", stripeLink: "", checkoutMode: "cart", link: "", active: true });
export default function ShopCatalogAdmin({ data, reload }) {
  const [form, setForm] = useState(null);
  const [id, setId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [orderedProducts, setOrderedProducts] = useState(data.products);
  useEffect(() => setOrderedProducts(data.products), [data.products]);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  function edit(p) {
    setId(p?.id || null); setNotice(""); setImageUrl("");
    setForm(p ? { ...blank(), ...p, checkoutMode: p.stripeLink ? "link" : "cart", stripeLink: p.stripeLink || "", link: p.link || "", price: (p.price / 100).toFixed(2), stock: p.stock ?? "", details: p.details.join("\n") } : blank());
  }
  async function save(e) {
    e.preventDefault(); setBusy(true); setNotice("");
    try {
      await api(id ? `/api/admin/shop/products/${id}` : "/api/admin/shop/products", { method: id ? "PUT" : "POST", body: { ...form, stripeLink: form.checkoutMode === "link" ? form.stripeLink : "", price: Math.round(Number(form.price) * 100), stock: form.stock === "" ? null : Number(form.stock), details: form.details.split("\n").filter(Boolean) } });
      setForm(null); setNotice("Product saved. Your shop has been updated."); reload();
    } catch (err) { setNotice(err.message); } finally { setBusy(false); }
  }
  async function upload(e) {
    const files = Array.from(e.target.files || []); e.target.value = "";
    if (!files.length) return;
    if (files.length + form.images.length > 12) { setNotice("Use up to 12 photos per product."); return; }
    setBusy(true); setNotice("");
    try {
      const body = new FormData(); files.forEach((f) => body.append("images", f));
      const res = await fetch("/api/admin/shop/images", { method: "POST", body, credentials: "same-origin" });
      const result = await res.json(); if (!res.ok) throw new Error(result.error || "Upload failed.");
      setForm((f) => ({ ...f, images: [...f.images, ...result.images] }));
    } catch (err) { setNotice(err.message); } finally { setBusy(false); }
  }
  function move(index, delta) {
    setForm((f) => { const images = [...f.images]; [images[index], images[index + delta]] = [images[index + delta], images[index]]; return { ...f, images }; });
  }
  async function remove(p) {
    if (!window.confirm(`Delete “${p.name}” from the shop? Past orders will be kept.`)) return;
    setBusy(true);
    try { await api(`/api/admin/shop/products/${p.id}`, { method: "DELETE" }); if (id === p.id) setForm(null); setNotice("Product deleted."); reload(); }
    catch (err) { setNotice(err.message); } finally { setBusy(false); }
  }
  async function moveProduct(product, direction) {
    setBusy(true); setNotice("");
    try {
      const result = await api(`/api/admin/shop/products/${product.id}/move`, { method: "PATCH", body: { direction } });
      setOrderedProducts(result.products);
      setNotice(`${product.name} moved ${direction}. Shop order saved.`);
      reload();
    } catch (err) { setNotice(err.message); } finally { setBusy(false); }
  }
  return <div className="admin-group admin-group--spaced">
    <div className="admin-section-head"><div><h2>Products</h2><p>Add products and photos here. Use Up and Down to set their order in the customer shop. Changes are saved immediately.</p></div><a className="admin-link" href="/shop" target="_blank" rel="noreferrer">View shop ↗</a><button className="button button--gold" disabled={busy} onClick={() => edit(null)}>Add product</button></div>
    {notice && <p role="status" className="form-status">{notice}</p>}
    {form && <form className="shop-editor" onSubmit={save}>
      <h3>{id ? "Edit product" : "New product"}</h3>
      <fieldset disabled={busy}>
        <div className="shop-editor__fields">
          <label>Product name<input required maxLength={120} value={form.name} onChange={set("name")} /></label>
          <label>Price (USD)<input type="number" required min="0.50" max="999999.99" step="0.01" value={form.price} onChange={set("price")} /></label>
          <label>Stock (blank = unlimited)<input type="number" min="0" step="1" value={form.stock} onChange={set("stock")} /></label>
          <label>Badge / short caption<input maxLength={80} value={form.tagline} onChange={set("tagline")} /></label>
        </div>
        <label>Description<textarea rows={4} maxLength={3000} value={form.description} onChange={set("description")} /></label>
        <label>Product details (one per line)<textarea rows={3} value={form.details} onChange={set("details")} /></label>
        <label>How customers buy<select value={form.checkoutMode} onChange={set("checkoutMode")}><option value="cart">Shop cart + automatic Stripe total (recommended)</option><option value="link">Separate Stripe payment link</option></select></label>
        {form.checkoutMode === "cart" ? <p className="admin-sub">Customers can buy this product alone or with other cart products. Stripe receives the saved prices, quantities, and one flat shipping fee for the whole order. No payment link is needed. Paid orders and stock updates appear here automatically.</p> : <><label>Stripe payment link<input required type="url" placeholder="https://buy.stripe.com/..." value={form.stripeLink} onChange={set("stripeLink")} /></label><p className="admin-sub">This product shows a separate “Buy now” button and cannot join a mixed cart. Set the same price and shipping in Stripe. These purchases are managed in Stripe and do not automatically update this shop’s stock or order list.</p></>}
        <label>Product website address (optional)<input type="url" placeholder="https://..." value={form.link} onChange={set("link")} /></label>
        <label className="shop-editor__checkbox"><input type="checkbox" checked={form.active} onChange={set("active")} /> Show this product in the shop</label>
        <h4>Photos ({form.images.length}/12)</h4><p className="admin-sub">The first photo is the cover. Customers can browse the rest in a carousel.</p>
        <label>Upload photos<input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={upload} /></label>
        <div className="shop-editor__url"><label>Or paste an image address<input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." /></label><button type="button" disabled={!imageUrl || form.images.length >= 12} onClick={() => { setForm((f) => ({ ...f, images: [...f.images, imageUrl.trim()] })); setImageUrl(""); }}>Add photo</button></div>
        <div className="shop-editor__photos">{form.images.map((url, index) => <div key={`${url}-${index}`}><img src={url} alt={`Product photo ${index + 1}`} /><span>{index === 0 ? "Cover" : `Photo ${index + 1}`}</span><div><button type="button" disabled={index === 0} aria-label={`Move photo ${index + 1} earlier`} onClick={() => move(index, -1)}>←</button><button type="button" disabled={index === form.images.length - 1} aria-label={`Move photo ${index + 1} later`} onClick={() => move(index, 1)}>→</button><button type="button" onClick={() => setForm((f) => ({ ...f, images: f.images.filter((_, i) => i !== index) }))}>Remove</button></div></div>)}</div>
        <div className="shop-editor__actions"><button className="button button--gold" type="submit" disabled={!form.images.length}>Save product</button><button type="button" className="admin-link" onClick={() => setForm(null)}>Cancel</button></div>
      </fieldset>{busy && <p role="status">Saving…</p>}
    </form>}
    <div className="shop-admin-products">{orderedProducts.map((p, index) => <article key={p.id}><img src={p.images[0]} alt="" /><div><strong>{p.name}</strong><p>${(p.price / 100).toFixed(2)} · {p.active ? "Visible" : "Hidden"} · {p.images.length} photos · {p.stripeLink ? "Separate payment link" : "Shop cart"}</p></div><button type="button" className="admin-link" disabled={busy || index === 0} aria-label={`Move ${p.name} up`} onClick={() => moveProduct(p, "up")}>↑ Up</button><button type="button" className="admin-link" disabled={busy || index === orderedProducts.length - 1} aria-label={`Move ${p.name} down`} onClick={() => moveProduct(p, "down")}>↓ Down</button><button className="admin-link" disabled={busy} onClick={() => edit(p)}>Edit</button><button className="admin-link" disabled={busy} onClick={() => remove(p)}>Delete</button></article>)}</div>
    {!data.products.length && <p>No products yet. Add your first product above.</p>}
    <div className="shop-editor"><h3>Automatic Stripe checkout</h3><p>Choose “Shop cart” for products you want customers to buy together. Checkout sends the product prices and quantities plus the shipping fee below to Stripe. Customers see the full total and enter their shipping address there.</p><p role="status">{data.checkoutReady ? "Stripe is connected. Automatic cart checkout is available." : "Automatic checkout needs the server’s Stripe secret key. Once configured, no individual product payment links are needed."}</p></div>
    <ShopSettings key={JSON.stringify(data.settings)} settings={data.settings} reload={reload} />
  </div>;
}

function ShopSettings({ settings, reload }) {
  const [fee, setFee] = useState((settings.shippingCents / 100).toFixed(2));
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState("");
  async function save(e) { e.preventDefault(); setBusy(true); try { await api("/api/admin/shop/settings", { method: "PUT", body: { shippingCents: Math.round(Number(fee) * 100) } }); setNotice("Shop settings saved."); reload(); } catch (err) { setNotice(err.message); } finally { setBusy(false); } }
  return <form className="shop-editor" onSubmit={save}><h3>Shop settings</h3><label>Flat shipping fee (USD)<input type="number" min="0" max="9999.99" step="0.01" required value={fee} onChange={(e) => setFee(e.target.value)} /></label><button className="button button--gold" disabled={busy}>Save settings</button>{notice && <p role="status">{notice}</p>}</form>;
}
