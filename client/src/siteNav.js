import { SHOP_IN_NAV } from "../../shared/shop.js";

// The main menu, shared by every public page so it can't drift between them.
// Paths are site-wide ("/#events" is the Events section of the home page); the
// home page itself turns them into in-page links.
export const navItems = [
  { label: "Home", href: "/" },
  { label: "Events", href: "/#events" },
  { label: "Girls on the Green", href: "/girls-on-the-green" },
  { label: "Magazine", href: "/magazine" },
  { label: "Foundation", href: "/foundation" },
  ...(SHOP_IN_NAV ? [{ label: "Shop", href: "/shop" }] : []),
  { label: "About Us", href: "/about" }
];
