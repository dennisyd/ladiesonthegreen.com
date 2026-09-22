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
