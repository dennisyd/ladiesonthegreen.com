import { SHOP_IN_NAV } from "../../shared/shop.js";

// The main menu, shared by every public page so it can't drift between them.
// An item with `children` is a dropdown. Paths are site-wide ("/#events" is the Events section of the home page); the
// home page itself turns them into in-page links.
export const navItems = [
  { label: "Home", href: "/" },
  { label: "Events", href: "/events" },
  { label: "Magazine", href: "/magazine" },
  {
    label: "Foundation",
    children: [
      { label: "Girls on the Green", href: "/girls-on-the-green" },
      { label: "Secure the Bag", href: "/foundation" }
    ]
  },
  ...(SHOP_IN_NAV ? [{ label: "Shop", href: "/shop" }] : []),
  { label: "Connect", href: "/connect" },
  { label: "About Us", href: "/about" }
];
