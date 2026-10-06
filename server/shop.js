import path from "node:path";
import { MAX_PER_ITEM, SHIPPING_CENTS, productById, products } from "../shared/shop.js";
import { jsonStore } from "./lib/store.js";

const iso = (unix) => (unix ? new Date(unix * 1000).toISOString() : new Date().toISOString());

// Cart lines travel through Stripe as "id:qty,id:qty" in the session metadata.
const encodeItems = (items) => items.map((i) => `${i.id}:${i.qty}`).join(",");
const decodeItems = (text) =>
  String(text || "")
    .split(",")
    .map((part) => {
      const [id, qty] = part.split(":");
      return { id, qty: Number(qty) };
    })
    .filter((i) => productById[i.id] && i.qty > 0);

export function createShop(dataDir, { stripe, requireAdmin }) {
  // stock: { productId: number | null } overrides the catalog's starting counts.
  const store = jsonStore(path.join(dataDir, "shop.json"), { stock: {}, orders: [] });

  const stockOf = (data, id) => (id in data.stock ? data.stock[id] : productById[id].stock);

  async function catalog() {
    const data = await store.read();
    return products.map((p) => ({ ...p, stock: stockOf(data, p.id) }));
  }

  // Validate a cart against the catalog and current stock.
  function checkCart(data, rawItems) {
    const merged = new Map();
    for (const item of Array.isArray(rawItems) ? rawItems : []) {
      const qty = Math.floor(Number(item?.qty));
      if (!productById[item?.id] || !(qty > 0)) continue;
      merged.set(item.id, (merged.get(item.id) || 0) + qty);
    }
    if (!merged.size) return { error: "Your cart is empty." };
    const items = [];
    for (const [id, qty] of merged) {
      const product = productById[id];
      const stock = stockOf(data, id);
      if (qty > MAX_PER_ITEM) return { error: `Please order ${MAX_PER_ITEM} or fewer of each item.` };
      if (stock !== null && qty > stock) {
        return {
          error: stock === 0 ? `${product.name} is sold out.` : `Only ${stock} left of ${product.name}. Please lower the quantity.`
        };
      }
      items.push({ id, qty });
    }
    return { items };
  }

  // Record a paid order once and take its items out of stock.
  async function recordOrder(session) {
    const items = decodeItems(session.metadata?.items);
    const details = session.customer_details || {};
    const shipping = session.collected_information?.shipping_details || session.shipping_details || {};
    const note = (session.custom_fields || []).find((f) => f.key === "note")?.text?.value || "";
    return store.update((data) => {
      if (data.orders.some((o) => o.id === session.id)) return false;
      const short = [];
      for (const { id, qty } of items) {
        const stock = stockOf(data, id);
        if (stock === null) continue;
        if (qty > stock) short.push(productById[id].name);
        data.stock[id] = Math.max(0, stock - qty);
      }
      data.orders.push({
        id: session.id,
        number: `LOTG-${1001 + data.orders.length}`,
        items: items.map(({ id, qty }) => ({ id, qty, name: productById[id].name, price: productById[id].price })),
        name: shipping.name || details.name || "",
        email: details.email || "",
        phone: details.phone || "",
        address: shipping.address || details.address || null,
        note,
        shippingCents: session.shipping_cost?.amount_total ?? session.total_details?.amount_shipping ?? 0,
        totalCents: session.amount_total ?? 0,
        paidAt: iso(session.created),
        status: "paid",
        shippedAt: null,
        // Two shoppers bought the last one at the same moment: needs a refund or a swap.
        oversold: short
      });
      return true;
    });
  }

  // Stripe webhook hook: returns "shop-order" when the event was a shop purchase.
  async function handleEvent(event) {
    const session = event.data.object;
    const isCheckout =
      event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded";
    if (!isCheckout || session.metadata?.lotg_shop !== "1") return null;
    if (session.payment_status === "unpaid") return "ignored";
    await recordOrder(session);
    return "shop-order";
  }

  function mountRoutes(app) {
    app.get("/api/shop", async (_req, res) => {
      res.json({ ok: true, products: await catalog(), shippingCents: SHIPPING_CENTS, checkoutReady: Boolean(stripe) });
    });

    app.post("/api/shop/checkout", async (req, res) => {
      if (!stripe) {
        return res.status(503).json({ ok: false, error: "Online checkout isn't available yet. Please email hello@ladiesonthegreen.com to order." });
      }
      const { items, error } = checkCart(await store.read(), req.body?.items);
      if (error) return res.status(400).json({ ok: false, error });

      const origin = process.env.SITE_URL || `${req.protocol}://${req.get("host")}`;
      try {
        const session = await stripe.checkout.sessions.create({
          mode: "payment",
          line_items: items.map(({ id, qty }) => ({
            quantity: qty,
            price_data: {
              currency: "usd",
              unit_amount: productById[id].price,
              product_data: { name: `Ladies On The Green ${productById[id].name}` }
            }
          })),
          shipping_address_collection: { allowed_countries: ["US"] },
          shipping_options: [
            {
              shipping_rate_data: {
                type: "fixed_amount",
                display_name: "Standard shipping (one flat fee per order)",
                fixed_amount: { amount: SHIPPING_CENTS, currency: "usd" }
              }
            }
          ],
          phone_number_collection: { enabled: true },
          custom_fields: [
            { key: "note", label: { type: "custom", custom: "Order note (e.g. hat logo preference)" }, type: "text", optional: true }
          ],
          metadata: { lotg_shop: "1", items: encodeItems(items) },
          success_url: `${origin}/shop?order=success`,
          cancel_url: `${origin}/shop`
        });
        res.json({ ok: true, url: session.url });
      } catch (err) {
        console.error("Shop checkout failed", err);
        res.status(500).json({ ok: false, error: "Checkout is temporarily unavailable. Please try again shortly." });
      }
    });

    // ---------- Admin ----------

    app.get("/api/admin/shop", requireAdmin, async (_req, res) => {
      const data = await store.read();
      res.json({
        ok: true,
        products: products.map((p) => ({ id: p.id, name: p.name, price: p.price, stock: stockOf(data, p.id) })),
        orders: data.orders.sort((a, b) => b.paidAt.localeCompare(a.paidAt))
      });
    });

    // stock: a whole number, or null for "plenty" (not counted).
    app.put("/api/admin/shop/stock/:id", requireAdmin, async (req, res) => {
      if (!productById[req.params.id]) return res.status(404).json({ ok: false, error: "Unknown product." });
      const raw = req.body?.stock;
      const stock = raw === null || raw === "" ? null : Math.floor(Number(raw));
      if (stock !== null && !(stock >= 0)) return res.status(400).json({ ok: false, error: "Enter 0 or more, or leave blank for unlimited." });
      await store.update((data) => {
        data.stock[req.params.id] = stock;
      });
      res.json({ ok: true, stock });
    });

    app.patch("/api/admin/shop/orders/:id", requireAdmin, async (req, res) => {
      const shipped = Boolean(req.body?.shipped);
      const order = await store.update((data) => {
        const o = data.orders.find((x) => x.id === req.params.id);
        if (!o) return null;
        o.status = shipped ? "shipped" : "paid";
        o.shippedAt = shipped ? new Date().toISOString() : null;
        return o;
      });
      if (!order) return res.status(404).json({ ok: false, error: "Order not found." });
      res.json({ ok: true, order });
    });
  }

  return { mountRoutes, handleEvent };
}
