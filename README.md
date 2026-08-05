# 🥧 Pi Monitor — from `localhost` to the public internet

A small live dashboard that shows my Raspberry Pi's health — CPU, RAM, temperature,
disk, load, and uptime — with an Apple-style "liquid glass" UI.

But the dashboard isn't really the point. The fun part was the **journey**: taking a
project running on a Raspberry Pi sitting in my room and making it reachable at a real
URL — **https://pi.sv7.space** — with HTTPS, from anywhere in the world, without
opening a single port on my router.

Here's the whole path, start to finish. 👇

---

## The goal

> Build something on a Raspberry Pi at home → view it on the internet at my own domain.

No cloud server. No paying for hosting. The Pi *is* the server.

---

## The stack

| Piece | What it does |
|-------|--------------|
| **Raspberry Pi 4** | The computer running everything, at home |
| **Next.js** | The web app (dashboard + a tiny API) |
| **Node's `/proc` + `statfs`** | Reads live system stats — no libraries needed |
| **Cloudflare Tunnel** | The magic that puts it on the internet |
| **Namecheap domain** | `sv7.space`, pointed at Cloudflare for DNS |

---

## Step 1 — Build the app on the Pi

The dashboard is a Next.js app. Where most monitoring tools reach for heavy libraries,
this just reads the numbers Linux already exposes:

- **CPU %** — sampled from `/proc/stat`
- **Memory** — from `/proc/meminfo`
- **Temperature** — from `/sys/class/thermal/...`
- **Disk** — from Node's built-in `statfs`

Zero extra dependencies. The frontend polls a `/api/stats` route every 2 seconds and
draws animated glass cards.

```bash
npm install
npm run build
npm start        # runs on http://localhost:3000
```

## Step 2 — See it on the home network

Running on the Pi, I could open it from my laptop using the Pi's local IP
(`http://10.x.x.x:3000`).

**First gotcha:** Next.js blocks its own assets when you open it from anything other
than `localhost` (a security default). The fix is one line in `next.config.ts`:

```ts
allowedDevOrigins: ["10.155.127.228"],
```

Now it worked on the LAN — but only for devices *in my house*. The internet still
couldn't see it.

## Step 3 — Put it on the internet with Cloudflare Tunnel

This is the key idea. Normally, exposing a home server means port-forwarding on your
router and exposing your home IP — fiddly and a security risk.

**Cloudflare Tunnel flips it around.** Instead of the internet reaching *in* to the Pi,
the Pi makes an **outbound** connection to Cloudflare and holds it open. Visitors hit
Cloudflare; Cloudflare passes the request down that tunnel to the Pi.

```
Visitor → https://pi.sv7.space → Cloudflare → 🔒 tunnel → Raspberry Pi (localhost:3000)
```

No open ports. No exposed home IP. Free HTTPS. 🎉

**Instant test** (a throwaway public URL in one command):
```bash
cloudflared tunnel --url http://localhost:3000
# → https://random-words.trycloudflare.com
```

## Step 4 — Use my own domain

The throwaway URL changes every restart, so I wired up my real domain, `sv7.space`
(registered at Namecheap).

The one thing the docs gloss over: **you don't need to buy a domain from Cloudflare.**
You keep it at Namecheap and just point its *nameservers* at Cloudflare so Cloudflare
manages the DNS (free).

1. Added `sv7.space` to Cloudflare (Free plan)
2. Changed the nameservers at Namecheap to the two Cloudflare gave me
3. Created a permanent named tunnel and linked a subdomain:

```bash
cloudflared tunnel login
cloudflared tunnel create pi-monitor
cloudflared tunnel route dns pi-monitor pi.sv7.space
cloudflared tunnel run pi-monitor
```

And that was it — **https://pi.sv7.space** now serves my Raspberry Pi, live, over HTTPS,
from anywhere. 🌍

---

## What I learned

- **Your Pi can be a real web server.** No cloud bill required.
- **Cloudflare Tunnel is the unlock** for home-hosting — outbound-only, no port
  forwarding, no exposed IP, free TLS.
- **You can bring any domain** (Namecheap, GoDaddy, anywhere) to Cloudflare just by
  switching nameservers.
- **Linux already knows everything** about itself — CPU, memory, temp, disk are all
  sitting in `/proc` and `/sys`, no libraries needed.

---

## Run it yourself

```bash
git clone https://github.com/suhaasv7/pi-monitor.git
cd pi-monitor
npm install
npm run build && npm start
```

Then follow Steps 3–4 above to put it online. Built with Next.js + Cloudflare Tunnel.
