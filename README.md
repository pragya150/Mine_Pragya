# Navintrix Website (Full Stack)

A working website for Navintrix — frontend + a real Node.js/Express backend.

## What's actually working here

- **Frontend** (`/public`): the site itself. It doesn't hardcode the service list —
  it fetches it live from the backend (`/api/services`), so you can edit one file
  to update every service, tag, and dropdown on the site.
- **Backend** (`/server`): an Express server that:
  - Serves the frontend
  - Exposes `GET /api/services` — the full service catalogue as JSON
  - Exposes `POST /api/contact` — a real contact form endpoint that:
    - Validates input
    - Saves every submission to `server/data/leads.json`
    - Optionally emails you a notification (if you fill in SMTP settings)
    - Rate-limits repeated submissions from the same visitor
  - Exposes `GET /api/leads?token=...` — a simple way to view submitted leads
    (protected by a shared secret you set yourself)

This has been tested locally and confirmed working (services load, form submits,
validation rejects bad input, leads get saved).

## Run it locally

You'll need [Node.js](https://nodejs.org) installed (v18 or newer).

```bash
cd server
npm install
cp .env.example .env       # then edit .env with your real values
npm start
```

Open **http://localhost:3000** — that's the whole site, frontend and backend, running together.

## Setting up the contact form email (optional but recommended)

The form saves every message to `server/data/leads.json` even without this step.
Email notifications are just a bonus so you don't have to keep checking the file.

1. Turn on 2-Step Verification on your Google account (pragya.parashar02@gmail.com or whichever inbox you want notifications in).
2. Create an **App Password** at https://myaccount.google.com/apppasswords
3. In `server/.env`, set:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your_email@gmail.com
   SMTP_PASS=the_16_character_app_password
   TO_EMAIL=where_you_want_notifications@gmail.com
   ```
4. Restart the server.

If you skip this, the form still works — messages just live in `leads.json` and
you can view them anytime at `/api/leads?token=YOUR_ADMIN_TOKEN`.

## Deploying it so it's live on the internet

This project runs anywhere Node.js runs. The easiest free options:

### Option A — Render.com (recommended, free tier)
1. Push this folder to a GitHub repo.
2. On [render.com](https://render.com), create a **New Web Service** → connect the repo.
3. Set:
   - **Root directory**: `server`
   - **Build command**: `npm install`
   - **Start command**: `npm start`
4. Add your `.env` values under Render's "Environment" tab (don't commit `.env` itself).
5. Render gives you a live URL like `https://navintrix.onrender.com`.

### Option B — Railway.app
Same idea as Render — connect the repo, point it at the `server` folder, add env vars, deploy.

### Option C — Your own VPS
```bash
git clone <your-repo>
cd navintrix-site/server
npm install
cp .env.example .env   # edit with real values
npm start              # or use pm2 to keep it running: pm2 start server.js
```
Put Nginx in front of it for a custom domain and HTTPS (e.g. via Certbot).

### Custom domain
Once deployed on Render/Railway/a VPS, point your domain's DNS (A or CNAME record)
to the host they give you. Both Render and Railway show the exact record to add.

## Editing your services

Everything in the "What we build" and "SaaS Products" sections comes from one file:

```
server/data/services.json
```

Add, remove, or reword services there — no HTML editing needed, no redeploy of the
frontend required, just restart the server (or redeploy if hosted).

## Viewing submitted leads

```
GET /api/leads?token=YOUR_ADMIN_TOKEN
```
Set `ADMIN_TOKEN` in `.env` to whatever secret you want. Treat this like a password —
anyone with the token can see every message submitted through your site.

## Project structure

```
navintrix-site/
├── public/           ← frontend (HTML, CSS, JS)
│   ├── index.html
│   ├── styles.css
│   └── script.js
├── server/           ← backend
│   ├── server.js
│   ├── package.json
│   ├── .env.example
│   └── data/
│       ├── services.json   ← edit this to change your services
│       └── leads.json      ← contact form submissions land here
└── README.md
```
