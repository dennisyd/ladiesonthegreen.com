// Stripe Payment Link for the Private Club Golf Experience ($79).
const golfExperienceRegistrationUrl = "https://buy.stripe.com/cNibJ17EndPy1f165cdby0A";

export const featuredEvents = [
  {
    image: "/private-club-golf-experience.jpg",
    alt: "Private Club Golf Experience flyer for Ladies On The Green at Country Club at Woodmore, Saturday October 3, 2026",
    badge: "Next Event",
    title: "Private Club Golf Experience",
    host: "Learn · Play · Connect — small group instruction with 2 PGA-certified pros",
    details: [
      "Saturday, October 3, 2026 · 1:00 PM",
      "Country Club at Woodmore — 12320 Pleasant Prospect Road, Mitchellville, MD 20721",
      "$79 per person · All skill levels welcome · Clubs provided · Limited to 20 spots"
    ],
    text: "A curated golf clinic in a private country club setting, designed to help you learn, improve your game, and make meaningful connections. Includes PGA-certified instruction, a networking reception afterward with drinks and conversation, and access to a beautiful private course.",
    tallImage: true,
    cta: { label: "Reserve Your Spot — $79 ↘", href: golfExperienceRegistrationUrl, external: true }
  },
  {
    id: "nyfw-glitz-and-glam",
    image: "/nyfw-glitz-and-glam-runway.jpg",
    alt: "Ladies On The Green NYFW Weekend flyer for the EPN NYFW Glitz & Glam Runway Extravaganza, Saturday September 12, 2026 at Léman Ballroom in New York",
    badge: "Past Event",
    title: "NYFW Weekend — Glitz & Glam Runway Extravaganza",
    host: "Network · Empower · Give Back · Shine — where style meets purpose",
    details: [
      "Saturday, September 12, 2026 · 8:00 PM Show",
      "Léman Ballroom — 41 Broad Street, New York, NY 10004",
      "EPN NYFW Runway Extravaganza · High fashion, bold beauty, lasting impact"
    ],
    text: "Ladies On The Green took over New York Fashion Week weekend with a night of high fashion, connection, and purpose at the EPN NYFW Glitz & Glam Runway Extravaganza — more than fashion, a movement. This event has already taken place.",
    tallImage: true,
    pastNote: "This event has taken place"
  },
  {
    image: "/martha-vineyard-social-meetup.jpg",
    alt: "Martha's Vineyard Golf Meet-Up flyer for Ladies On The Green at Farm Neck Golf Club, Wednesday August 12 at 10:00 AM",
    badge: "Past Event",
    title: "Martha’s Vineyard Golf Meet-Up",
    host: "Connect · Learn · Swing · Thrive — a free impromptu golf meet-up",
    details: [
      "Wednesday, August 12, 2026 · 10:00 AM",
      "Farm Neck Golf Club — 1 Farm Neck Way, Oak Bluffs, MA 02557",
      "Free to attend · All skill levels welcome"
    ],
    text: "Whether you’re new to golf or an experienced player, come practice at the driving range, sharpen your swing, and connect with an amazing community of women who share a passion for golf, friendship, and networking. Range balls and any golf fees are the responsibility of each participant. This event has already taken place.",
    tallImage: true,
    pastNote: "Sold out · This event has taken place"
  },
  {
    id: "mv-meetup-listing",
    image: "/martha-vineyard-social-meetup-listing.jpg",
    alt: "Ladies On The Green Martha's Vineyard Golf Meet-Up event listing showing Sold Out",
    badge: "Past Event",
    title: "Martha’s Vineyard Golf Meet-Up",
    host: "Connect · Learn · Swing · Thrive — a free impromptu golf meet-up",
    details: [
      "Wednesday, August 12, 2026 · 10:00 AM",
      "Farm Neck Golf Club — 1 Farm Neck Way, Oak Bluffs, MA 02557",
      "Free to attend · All skill levels welcome"
    ],
    text: "Whether you’re new to golf or an experienced player, come practice at the driving range, sharpen your swing, and connect with an amazing community of women who share a passion for golf, friendship, and networking. Range balls and any golf fees are the responsibility of each participant. This event has already taken place.",
    pastNote: "Sold out · This event has taken place"
  },
  {
    image: "/sunrise-yoga-on-the-beach.jpg",
    alt: "Sunrise Yoga on the Beach flyer for Ladies On The Green at Inkwell Beach, Oak Bluffs, Thursday August 13, 2026",
    badge: "Past Event",
    title: "Sunrise Yoga on the Beach",
    host: "Breathe · Stretch · Connect — a Martha's Vineyard morning of movement and mindfulness",
    details: [
      "Thursday, August 13, 2026 · 8:00 AM",
      "Inkwell Beach — Oak Bluffs, MA",
      "Free to join · All experience levels welcome"
    ],
    text: "A sunrise beach yoga session to start the Martha’s Vineyard morning with movement, mindfulness, and meaningful connections. This event has already taken place.",
    tallImage: true,
    pastNote: "This event has taken place"
  },
  {
    image: "/ladies-love-lemonade.jpg",
    alt: "Ladies Love Lemonade golf clinic flyer, presented by Joe Golf and Kappa Alpha Psi Fraternity Inc, Baltimore Alumni Chapter",
    badge: "Past Event",
    title: "Ladies Love Lemonade",
    host: "Presented by Joe Golf, in conjunction with Kappa Alpha Psi Fraternity, Inc. — Baltimore Alumni Chapter",
    details: [
      "Friday, July 10, 2026 · 11:00 AM – 1:00 PM",
      "Pine Ridge Golf Course — 3060 Ridge Rd, Eldersburg, MD 21784",
      "Complimentary · Ladies only, all skill levels"
    ],
    text: "A curated golf experience and clinic for ladies. An introductory session led by PGA instructors covering the basics and fundamentals of golf, putting, and chipping — with complimentary lemonade courtesy of Tito’s. This event has already taken place.",
    pastNote: "This event has taken place"
  }
];

export const galleryEvents = [
  {
    title: "Welcome Scramble",
    tag: "Play",
    text: "A relaxed round designed to introduce members and make the first tee feel easy."
  },
  {
    title: "Range & Rose",
    tag: "Clinic",
    text: "Swing tips, short-game practice, and a social finish with the group."
  },
  {
    title: "Founding Brunch",
    tag: "Social",
    text: "A polished gathering for new members, partners, and local supporters."
  },
  {
    title: "Nine & Network",
    tag: "Connect",
    text: "Nine holes followed by intentional networking and conversation."
  },
  {
    title: "Course Confidence",
    tag: "Learn",
    text: "Etiquette, pace, club selection, and on-course support for newer golfers."
  },
  {
    title: "Pink Flag Classic",
    tag: "Signature",
    text: "A seasonal celebration of golf, friendship, and giving back."
  }
];
