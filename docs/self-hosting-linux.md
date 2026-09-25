# Self-host Supabase on a spare Linux machine

For AJL Group's dashboard. Goal: replace Supabase's hosted cloud with a copy
of the same stack running on our own Linux box — same code, same
migrations, $0 hosting cost, no third party holding the data.

**How to use this file:** either follow it by hand on the Linux machine, or
paste this whole file as a prompt into a Claude Code session running on that
machine and ask it to execute the steps, checking in at each phase.

Two phases: **Phase 1** gets it running and reachable for testing (today).
**Phase 2** is what to add before trusting it with real work (later, once
Phase 1 is proven out).

---

## Before you start

- A Linux machine (any reasonably recent distro; commands below assume
  Debian/Ubuntu — adjust package manager if it's something else) that can
  stay on while testing.
- Regular home internet is fine — this setup does **not** require a public
  IP or forwarding any router ports.
- A copy of this project's `supabase/` folder (has the migrations) — copy it
  over via `scp`, a USB drive, or `git clone` the repo on that machine.

## Phase 1 — get it running, reachable from anywhere

### 1. Install Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# log out and back in (or `newgrp docker`) so the group change applies
```

### 2. Install the Supabase CLI

```bash
curl -fsSL https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz | tar xz
sudo mv supabase /usr/local/bin/
supabase --version
```

### 3. Get the project's `supabase/` folder onto this machine

Either:

```bash
git clone https://github.com/Asaply/AJL-Group.git
cd AJL-Group
```

or copy just the `supabase/` folder from the Mac if you don't want the full
app repo here.

### 4. Start the stack

```bash
cd AJL-Group   # the folder containing supabase/
supabase start
```

This applies every migration in `supabase/migrations/` in order (same
Postgres, Auth, Storage, Realtime, Studio the Mac runs locally). When it
finishes, `supabase status` prints the local URLs and keys — keep that
output, you'll need the API URL and the `anon key` in Phase 3.

### 5. Reseed the three partner accounts

```bash
# from the app repo, with SEED_PASSWORD_ALAN / _JAZIEL / _LEO set in .env.local
npm install
npm run seed
```

### 6. Make it reachable without opening router ports

Install `cloudflared` (Cloudflare Tunnel — free):

```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb
```

**With a domain already pointed at Cloudflare:**

```bash
cloudflared tunnel login
cloudflared tunnel create ajl-supabase
cloudflared tunnel route dns ajl-supabase api.YOURDOMAIN.com
cloudflared tunnel run --url http://localhost:54321 ajl-supabase
```

(`54321` is the default Kong/API gateway port from `supabase start` —
double check with `supabase status`, look for "API URL".)

**No domain yet, just testing:** use a free temporary URL instead —

```bash
cloudflared tunnel --url http://localhost:54321
```

This prints a random `https://something.trycloudflare.com` URL on start.
It changes every time you restart it — fine for a first test, not for
anything longer-lived.

### 7. Point the app at it

In the Next.js app's `.env.local` (on whichever machine runs the app —
doesn't have to be this Linux box):

```
NEXT_PUBLIC_SUPABASE_URL=https://api.YOURDOMAIN.com        # or the trycloudflare.com URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from `supabase status`>
SUPABASE_SERVICE_ROLE_KEY=<service_role key from `supabase status`>
```

Restart the app (`npm run dev` or redeploy). Everything else — RLS,
Storage buckets, Realtime — needs no code changes; it's the same Supabase.

---

## Phase 2 — before trusting this for real work

Do these once Phase 1 is proven out and before the team relies on it day to
day:

- **Backups.** `supabase start` does not back up Postgres on its own. Add a
  cron job dumping the DB (`docker exec supabase_db_<project> pg_dump -U
  postgres postgres | gzip > backup-$(date +%F).sql.gz`) somewhere off this
  machine (another disk, cloud storage, anywhere but the same box).
- **Survive a reboot.** `sudo systemctl enable docker` so Docker (and the
  Supabase containers, which Docker restarts automatically) come back up if
  the machine restarts or loses power.
- **Keep the tunnel running in the background**, not just in a terminal
  you'll close: `sudo cloudflared service install` (installs it as a
  systemd service that survives reboots and logouts).
- **Switch from the CLI dev stack to Supabase's production
  `docker-compose`.** The CLI's `supabase start` is meant for local
  development — Studio has no auth wall by default, and secrets are
  fixed/well-known local-dev values, fine only because nothing was reachable
  from outside. For anything long-lived, follow
  https://supabase.com/docs/guides/self-hosting/docker to set real generated
  secrets and lock down Studio access before it's exposed through the
  tunnel.
- **Monitor uptime.** If this Linux box goes offline (power cut, ISP outage,
  reboot with Docker not coming back), the whole app goes down for
  everyone — unlike hosted Supabase, there's no automatic failover. A cheap
  free uptime pinger (UptimeRobot, etc.) hitting the API URL is worth
  setting up.

## If something breaks

Paste the exact error and the output of `supabase status` and
`docker ps` back into a Claude Code session (on this machine or the Mac) —
that's enough context to debug from.
