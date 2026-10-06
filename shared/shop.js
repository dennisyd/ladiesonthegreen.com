// Shop catalog, shared by the Shop page (client) and the server (checkout,
// stock, orders). Prices are in cents. `stock` is the starting count; null means
// "plenty" (not counted). Live stock is tracked on the server and can be changed
// in /admin → Shop without editing this file.

// Whether "Shop" appears in the site menus. While false, the shop is still
// reachable by typing /shop, it just isn't linked. Set to true to launch it.
export const SHOP_IN_NAV = false;

// One flat fee per order, however many items are in it. US addresses only.
export const SHIPPING_CENTS = 599;
export const MAX_PER_ITEM = 10;

export const products = [
  {
    id: "hat-pink",
    name: "Signature Cap — Light Pink",
    price: 1499,
    stock: 4,
    image: "/merch/hat-pink.jpg",
    tagline: "Limited run",
    description:
      "A soft light-pink cap with a structured crown and curved brim, finished with the Ladies On The Green logo front and center. Made for sunny tee times and coffee runs alike.",
    details: [
      "Front logo comes in two designs: the round club logo or the gold laurel crest",
      "Tell us your logo preference at checkout; we'll match it while supplies last",
      "One size"
    ]
  },
  {
    id: "hat-white",
    name: "Signature Cap — White",
    price: 1499,
    stock: 3,
    image: "/merch/hat-white.jpg",
    tagline: "Limited run",
    description:
      "The classic: a crisp white cap with a structured crown and curved brim, carrying the Ladies On The Green logo. Clean, bright, and right at home with any golf outfit.",
    details: [
      "Front logo comes in two designs: the round club logo or the gold laurel crest",
      "Tell us your logo preference at checkout; we'll match it while supplies last",
      "One size"
    ]
  },
  {
    id: "bottle",
    name: "Glass Water Bottle",
    price: 299,
    stock: null,
    image: "/merch/bottle.jpg",
    tagline: "Member favorite",
    description:
      "A clear glass bottle with a brushed stainless-steel screw cap and the full-color Ladies On The Green logo. Stay hydrated from the first tee to the clubhouse.",
    details: ["Clear glass with stainless-steel cap", "Full-color club logo", "Packed carefully for shipping"]
  },
  {
    id: "journal",
    name: "LOTG Journal & Pen Set",
    price: 499,
    stock: null,
    image: "/merch/journal.jpg",
    tagline: "Journal + pen",
    description:
      "A green soft-touch journal with the Ladies On The Green logo pressed into the cover and a gold-tone buckle closure. Comes with a matching green pen in its own loop, ready for scores, goals, and good ideas.",
    details: ["Soft-touch green cover with debossed logo", "Gold-tone magnetic buckle closure", "Matching pen included"]
  }
];

export const productById = Object.fromEntries(products.map((p) => [p.id, p]));

export const formatCents = (cents) => `$${(cents / 100).toFixed(2)}`;
