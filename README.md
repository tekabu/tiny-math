# Tiny Math

Toddler math quizzes (addition, subtraction, less/greater/equal) with parent + kid accounts.
One small Node server (Express + built-in `node:sqlite`) serves the app and stores everything
in a single SQLite file, so every device — laptop, iPad, Android — shares the same data.

Requires **Node 22.18+** (runs the TypeScript server directly, no build step for it).

## Local dev / testing

```sh
npm install
npm run dev
```

Starts the API server (port 3000) and Vite (port 5173) together. Open:

- this computer: http://localhost:5173
- iPad / Android on the same Wi-Fi: `http://<this computer's IP>:5173` (Vite prints it as "Network")

First launch asks for the parent password.

## Production (PM2)

```sh
cp .env.example .env          # set PORT, HOST, DATA_DIR, TRUST_PROXY
npm ci
npm run build                 # builds the frontend into dist/
pm2 start ecosystem.config.cjs
pm2 save && pm2 startup       # restart on reboot
```

The server serves both `dist/` and `/api` on `PORT`. Update: `git pull && npm ci && npm run build && pm2 restart tiny-math`.

### Putting it on a domain

Point your tunnel / proxy at `http://localhost:<PORT>` and set `HOST=127.0.0.1` in `.env`
so the app isn't reachable except through it.

- **cloudflared**: `cloudflared tunnel route dns <tunnel> math.example.com`, then in the tunnel
  config: `service: http://localhost:3000`. Keep `TRUST_PROXY=loopback`.
- **Nginx Proxy Manager**: new proxy host → forward to the VPS IP/port 3000, enable SSL
  (Let's Encrypt). If NPM runs in Docker, use `HOST=0.0.0.0`, firewall the port from the
  internet, and set `TRUST_PROXY=loopback, uniquelocal`.

### Backups

All data is `DATA_DIR/tiny-math.db` (default `./data`). Back up that folder
(`sqlite3 tiny-math.db ".backup backup.db"` for a consistent copy while running).

## How it works

- Parent: create kids, create tests (type, min, max, how many, who), see results live.
- Kid: sees active tests, one question at a time. Blue = right, red = wrong (tap to see
  the answer, tap again for next). 100% breaks the piñata.
- The server grades answers and only accepts the next unanswered question, so there's no
  going back even with refresh or the browser back button.
- Logins are rate-limited (5 wrong tries → 1 minute wait), passwords are scrypt-hashed,
  sessions last 30 days.
