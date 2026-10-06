import React, { useEffect, useMemo, useState } from "react";
import { MAX_PER_ITEM, SHIPPING_CENTS, SHOP_IN_NAV, formatCents, products as catalog } from "../../shared/shop.js";
import { api } from "./api.js";

const CART_KEY = "lotg_cart";

const navItems = [
  { label: "Home", href: "/" },
  { label: "Events", href: "/#events" },
  { label: "Membership", href: "/#membership" },
  { label: "Shop", href: "/shop" },
  { label: "Magazine", href: "/magazine" }
];

function loadCart() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(CART_KEY) || "{}");
    return saved && typeof saved === "object" ? saved : {};
  } catch {
    return {};
  }
}

export default function ShopPage() {
  const ordered = new URLSearchParams(window.location.search).get("order") === "success";
  const [menuOpen, setMenuOpen] = useState(false);
  // Start from the built-in catalog so the page is never empty; the server adds live stock.
  const [products, setProducts] = useState(catalog);
  const [cart, setCart] = useState(() => (ordered ? {} : loadCart())); // { productId: qty }
  const [state, setState] = useState({ status: "idle", message: "" });

  useEffect(() => {
    document.title = "Shop | Ladies On The Green";
    if (!SHOP_IN_NAV) {
      // Not launched yet: keep the page out of search results.
      let robots = document.querySelector('meta[name="robots"]');
      if (!robots) {
        robots = document.createElement("meta");
        robots.name = "robots";
        document.head.appendChild(robots);
      }
      robots.content = "noindex";
    }
    api("/api/shop").then((data) => setProducts(data.products), () => {});
  }, []);

  useEffect(() => {
    window.localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }, [cart]);

  const limitFor = (product) => Math.min(MAX_PER_ITEM, product.stock ?? MAX_PER_ITEM);

  function setQty(product, qty) {
    setState({ status: "idle", message: "" });
    setCart((current) => {
      const next = { ...current };
      const clamped = Math.max(0, Math.min(limitFor(product), qty));
      if (clamped) next[product.id] = clamped;
      else delete next[product.id];
      return next;
    });
  }

  const lines = useMemo(
    () =>
      products
        .filter((p) => cart[p.id] > 0)
        .map((p) => ({ product: p, qty: Math.min(cart[p.id], limitFor(p)) }))
        .filter((line) => line.qty > 0),
    [products, cart]
  );
  const itemCount = lines.reduce((sum, line) => sum + line.qty, 0);
  const subtotal = lines.reduce((sum, line) => sum + line.qty * line.product.price, 0);

  async function checkout() {
    setState({ status: "loading", message: "" });
    try {
      const { url } = await api("/api/shop/checkout", {
        method: "POST",
        body: { items: lines.map((line) => ({ id: line.product.id, qty: line.qty })) }
      });
      window.location.href = url;
    } catch (err) {
      setState({ status: "error", message: err.message });
      api("/api/shop").then((data) => setProducts(data.products), () => {}); // stock may have changed
    }
  }

  return (
    <>
      <header className="site-header" aria-label="Primary navigation">
        <a className="brand" href="/" aria-label="Ladies On The Green home">
          <img src="/ladiesonthegreen.png" alt="" />
        </a>
        <span aria-hidden="true" />
        <button className="menu-toggle" type="button" onClick={() => setMenuOpen((open) => !open)}>
          {menuOpen ? "Close" : "Menu"}
        </button>
        <nav className={menuOpen ? "is-open" : ""}>
          {navItems.map((item) => (
            <a href={item.href} key={item.href} aria-current={item.href === "/shop" ? "page" : undefined}>{item.label}</a>
          ))}
        </nav>
        <div className="header-actions">
          <a className="header-cta" href="#cart">Cart ({itemCount})</a>
        </div>
      </header>

      <main className="shop">
        <section className="shop-hero">
          <span className="section-kicker">The LOTG Shop</span>
          <h1>Wear the club. Carry the community.</h1>
          <p>Signature Ladies On The Green pieces for the course, the clubhouse, and everywhere in between.</p>
          <p className="shop-hero__shipping">
            One flat {formatCents(SHIPPING_CENTS)} shipping fee per order, no matter how many items you add.
          </p>
        </section>

        {ordered && (
          <div className="shop-banner" role="status">
            <strong>Thank you! Your order is confirmed.</strong>
            <span>A receipt is on its way to your email, and we&rsquo;ll ship your order soon.</span>
          </div>
        )}

        <div className="shop-layout">
          <div className="shop-grid">
            {products.map((product) => {
              const soldOut = product.stock === 0;
              const inCart = cart[product.id] || 0;
              const atLimit = inCart >= limitFor(product);
              return (
                <article className={`shop-card${soldOut ? " is-sold-out" : ""}`} key={product.id}>
                  <div className="shop-card__image">
                    <img src={product.image} alt={product.name} loading="lazy" />
                    <span className="shop-card__tag">{soldOut ? "Sold out" : product.tagline}</span>
                  </div>
                  <div className="shop-card__body">
                    <div className="shop-card__head">
                      <h2>{product.name}</h2>
                      <strong>{formatCents(product.price)}</strong>
                    </div>
                    <p>{product.description}</p>
                    <ul>
                      {product.details.map((detail) => (
                        <li key={detail}>{detail}</li>
                      ))}
                    </ul>
                    {product.stock !== null && product.stock > 0 && (
                      <p className="shop-card__stock">Only {product.stock} left</p>
                    )}
                    {inCart ? (
                      <div className="shop-qty" aria-label={`Quantity of ${product.name}`}>
                        <button type="button" onClick={() => setQty(product, inCart - 1)} aria-label="Remove one">−</button>
                        <span>{inCart} in cart</span>
                        <button type="button" onClick={() => setQty(product, inCart + 1)} disabled={atLimit} aria-label="Add one">+</button>
                      </div>
                    ) : (
                      <button type="button" className="button button--gold" onClick={() => setQty(product, 1)} disabled={soldOut}>
                        {soldOut ? "Sold out" : "Add to cart"}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          <aside className="shop-cart" id="cart" aria-labelledby="cart-title">
            <h2 id="cart-title">Your cart</h2>
            {lines.length === 0 ? (
              <p className="shop-cart__empty">Your cart is empty. Add a few favorites; shipping stays the same.</p>
            ) : (
              <>
                <ul className="shop-cart__lines">
                  {lines.map(({ product, qty }) => (
                    <li key={product.id}>
                      <div>
                        <strong>{product.name}</strong>
                        <span>{qty} × {formatCents(product.price)}</span>
                      </div>
                      <div className="shop-cart__line-end">
                        <strong>{formatCents(qty * product.price)}</strong>
                        <button type="button" className="admin-link" onClick={() => setQty(product, 0)}>Remove</button>
                      </div>
                    </li>
                  ))}
                </ul>
                <dl className="shop-cart__totals">
                  <dt>Subtotal</dt><dd>{formatCents(subtotal)}</dd>
                  <dt>Shipping (flat, per order)</dt><dd>{formatCents(SHIPPING_CENTS)}</dd>
                  <dt className="is-total">Total</dt><dd className="is-total">{formatCents(subtotal + SHIPPING_CENTS)}</dd>
                </dl>
                <button type="button" className="checkout__pay" onClick={checkout} disabled={state.status === "loading"}>
                  {state.status === "loading" ? "Please wait..." : "Checkout securely"}
                </button>
              </>
            )}
            {state.message && <p className={`form-status form-status--${state.status}`} role="alert">{state.message}</p>}
            <p className="shop-cart__note">
              &#128274; Payment and shipping address are entered on Stripe&rsquo;s secure page. Ships within the United States.
            </p>
          </aside>
        </div>
      </main>

      {itemCount > 0 && (
        <a className="shop-cart-bar" href="#cart">
          View cart ({itemCount}) · {formatCents(subtotal + SHIPPING_CENTS)}
        </a>
      )}
    </>
  );
}
