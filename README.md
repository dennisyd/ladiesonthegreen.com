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
