# Ladies On The Green

React frontend + Node.js backend for `ladiesonthegreen.com`.

## Project structure

```text
client/   React + Vite frontend
server/   Express backend and production static server
```

## Local setup

```bash
npm install
npm run dev
```

This starts the Express API on `http://localhost:3000` and the React app on `http://localhost:5173`. The Vite dev server proxies `/api` calls to the backend.

## Production

```bash
npm install
npm run build
npm start
```

The Express server serves the React build from `client/dist/` and listens on `PORT` or `3000`.

## Contact form email

The "Send Inquiry" form posts to `/api/contact`. In production, configure SMTP environment variables before starting the server:

```bash
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=hello@ladiesonthegreen.com
SMTP_PASS=your_smtp_password
SMTP_FROM=hello@ladiesonthegreen.com
CONTACT_TO=hello@ladiesonthegreen.com
```

Use `SMTP_PORT=465` or `SMTP_SECURE=true` when your mail provider requires SSL.

## Digital magazine (flipbook)

- `/magazine` — public page-turning viewer. Renders the PDF entirely in the browser (pdf.js), page by page, inside a flipbook (react-pageflip). No server-side conversion needed.
- `/magazine/admin` — password-gated upload form. Uploading a PDF replaces the issue shown at `/magazine`; only one issue is live at a time, and the previous file is deleted automatically.

Set an admin password before starting the server, or uploads are refused:

```bash
MAGAZINE_ADMIN_PASSWORD=choose_a_password
```

Uploaded PDFs are stored on disk at `server/uploads/magazine/` (gitignored) with metadata in `server/data/magazine.json` (gitignored) — both persist across deploys as long as you don't wipe the VPS filesystem, but they are **not** part of the git repo or the deploy pull. Back up `server/uploads/` and `server/data/` separately if the current issue matters.

## Members, payments, and admin

- `/join` — Founding Membership sign-up. Filling in the form does **not** create a member: the details wait in `server/data/signups.json` and the visitor is sent to the Stripe Payment Link for the current price. Only a confirmed payment creates the member (carrying over the form details). Unfinished sign-ups show in `/admin` → Follow-ups, where they can be reminded, marked as paid by hand (cash/check), or deleted; they expire on their own after 30 days. Prices, the founding-rate deadline, and the Payment Links live in `shared/membership.js` (used by both the client and the server).
- `/admin` — password-protected dashboard: member list with payment status, CSV export, follow-up reminders for people who registered but didn't pay, event ticket registrations, member offers, announcement emails, and a Stripe sync.
- `/members` — member portal. Members sign in with a one-time link emailed to them (no passwords). Only active (or past-due, so they can fix their card) members get in. Shows their membership, offers and discount codes, member events, the opt-in member directory, and a "Manage billing" button (Stripe's customer portal).

### Server settings

Put these in a `.env` file at the repo root on the VPS (`/var/www/ladiesonthegreen.com/.env`, gitignored) or in the PM2 environment. Variables already set in the environment take priority over the file. Restart the app after changing them (`pm2 restart ladiesonthegreen`).

```bash
ADMIN_PASSWORD=choose_a_dashboard_password      # falls back to MAGAZINE_ADMIN_PASSWORD if unset
STRIPE_SECRET_KEY=sk_live_...                    # Stripe → Developers → API keys
STRIPE_WEBHOOK_SECRET=whsec_...                  # from the webhook endpoint below
SITE_URL=https://ladiesonthegreen.com            # optional; used in emailed links
```

The SMTP settings above are also required in production: sign-in links, reminders, and announcements are sent by email. Without SMTP (local development) those emails are printed to the server log instead.

### Stripe setup (one time)

1. **Webhook** — Stripe Dashboard → Developers → Webhooks → Add endpoint:
   - URL: `https://ladiesonthegreen.com/api/stripe/webhook`
   - Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`
   - Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
2. **Customer portal** — Settings → Billing → Customer portal: allow updating payment methods and canceling, then **Save** (the "Manage billing" button needs this saved once).
3. In `/admin` → Settings, run **Sync now** to pull in payments made before the webhook existed.

Only purchases made through the Payment Links listed in `shared/membership.js` are tracked, so other products on the same Stripe account never appear. When you create a new Payment Link (e.g. the $149 price), add it there.

### Shop

- `/shop` — merchandise with a cart and Stripe Checkout. Shipping is one flat fee per order (US addresses only), so several items ship for the same price.
- The catalog (names, prices, descriptions, photos, starting stock) and the shipping fee live in `shared/shop.js`. Product photos are in `client/public/merch/`.
- Paid orders arrive through the same Stripe webhook and appear in `/admin` → Shop with the shipping address and any order note. Stock counts down as orders are paid; adjust it (or mark an item sold out) in the same tab.
- The Stripe key needs **Checkout Sessions: Write** for the shop to create checkouts (membership tracking alone only needs Read).

### Data and backups

Members, offers, event registrations, and announcement history are JSON files in `server/data/` (gitignored, alongside the magazine metadata). They persist across deploys but are not in git — back up `server/data/` regularly.

## VPS deployment outline

1. Push this folder to GitHub.
2. On the VPS, install Node.js 20 or newer.
3. Clone your GitHub repo.
4. Run `npm install` and `npm run build`.
5. Start the app with a process manager such as PM2:

```bash
npm install -g pm2
pm2 start npm --name ladiesonthegreen -- start
pm2 save
pm2 startup
```

6. Put Nginx in front of Node and proxy traffic to port `3000`.

Example Nginx server block:

```nginx
server {
    server_name ladiesonthegreen.com www.ladiesonthegreen.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

After DNS points to your VPS, use Certbot to add HTTPS:

```bash
sudo certbot --nginx -d ladiesonthegreen.com -d www.ladiesonthegreen.com
```

## Porkbun DNS

In Porkbun DNS, create:

- `A` record for `@` pointing to your VPS IPv4 address.
- `A` record for `www` pointing to your VPS IPv4 address.
- If your VPS has IPv6, add matching `AAAA` records.

DNS can take a little while to propagate. Once it resolves to your VPS, Nginx and Certbot can finish the public launch.
