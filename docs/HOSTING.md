# Hosting the roster reader

The phone apps plan everything on the phone. The only thing that needs a server on the internet is the **roster
reader** (`/api/roster/parse`), because it holds the Gemini key, which must never be inside the app. The same server
can also serve the web version of the app.

## What any host needs

| Need | How |
|---|---|
| Run a Node.js app | The `Dockerfile` in the project, or "Node" with build command `npm ci && npm run build` and start command `npm start` |
| HTTPS address | Every host below gives one (e.g. `https://crewcircadian.onrender.com`) |
| Settings (secrets) | Set in the host's dashboard, never in Git: see the table below |
| Size | Small: 0.5 CPU and 512 MB memory is plenty to start |

| Setting | Value |
|---|---|
| `GEMINI_API_KEY` | A **paid** (billing-enabled) Gemini key. On the free tier Google may use what is sent to it |
| `NODE_ENV` | `production` |
| `HOST` | `0.0.0.0` |
| `TRUST_PROXY` | `1` |
| `ALLOWED_ORIGINS` | The web address, if you also publish the web version |
| `GEMINI_DAILY_LIMIT` | Daily cap on AI reads, e.g. `200`: protects your bill if someone misuses the reader |

## Choosing a host (check current prices on their sites)

| Option | Good for | Notes |
|---|---|---|
| **Render** (render.com) | Easiest start | Connect the GitHub repo, pick "Web Service", Docker. Free tier sleeps when idle (first read is slow); a small paid instance stays awake |
| **Railway** (railway.app) | Easy, pay for what you use | Connect GitHub, it finds the Dockerfile |
| **Fly.io** | Servers close to India (Mumbai region) | Command-line set-up (`fly launch`) |
| **A small virtual server** (DigitalOcean, AWS Lightsail, Hetzner) | Cheapest at scale, full control | You install updates and HTTPS yourself |

For a first beta, a Render or Railway web service in a region near India is the simplest. Expect a small monthly
cost for an always-on instance, plus Gemini's per-read charge (a roster read is a fraction of a rupee to a few
rupees, depending on the model and image size).

## After it is running

1. Open `https://YOUR-ADDRESS/` in a browser: the web app should load.
2. Build the phone apps pointing at it (see `docs/PHONE_APP.md`):
   `echo 'VITE_API_BASE=https://YOUR-ADDRESS' > .env.production.local` then `npm run app:sync`.
3. Upload one roster from a phone and check it reads.

## Limits to know

- **No accounts.** Anyone who finds the address could call the reader; the daily cap limits the cost. Before a
  public launch, add app attestation (Apple App Attest / Google Play Integrity) so only the real app can call it.
- The server keeps nothing: no database, no copies of rosters. Logs hold only error messages.
