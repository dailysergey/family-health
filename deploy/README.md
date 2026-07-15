# deploy — Docker one-shot

Everything the app needs (Next.js, health-ui MCP, tmux + Claude Code CLI) in one image, driven by `docker-compose`.

## Quick start

```bash
git clone https://github.com/dailysergey/family-health.git
cd family-health
bash deploy/deploy.sh
```

That's it. The script:

1. Copies `deploy/.env.example` → `deploy/.env`, generates a random `HEALTH_INGEST_SECRET` (via `openssl rand`) and prompts for a PIN.
2. Creates the `data/` folder on the host and seeds it from `data.example/` if empty.
3. Warns if your Claude Code CLI credentials (`~/.claude`, `~/.claude.json`) are missing — run `claude` once on the host to authenticate.
4. `docker compose build` + `docker compose up -d`.
5. Waits for `/api/members` to come alive, prints the URL.

Open `http://<host>:3100`, enter the PIN from `deploy/.env`.

## Requirements on the host

- Docker + `docker compose` plugin.
- Claude Code CLI authenticated once (`claude` in your shell — OAuth flow). Its credentials are bind-mounted into the container.
- Ports: `3100/tcp` published by default (change via `HEALTH_PORT` in `.env`).

## Data & credentials — where they live

| Path on host | Purpose | Notes |
|---|---|---|
| `HEALTH_DATA_DIR` (default `deploy/data`) | family JSONs + PDFs | never leaves the host, gitignored |
| `~/.claude` | Claude CLI settings | mounted RO into `/root/.claude` |
| `~/.claude.json` | Claude CLI OAuth token | mounted RO into `/root/.claude.json` |

Change any of these in `deploy/.env`.

## Common operations

```bash
# Follow logs
docker compose -f deploy/docker-compose.yml logs -f

# Enter the container (e.g. to `tmux attach -t health` and watch Claude think)
docker compose -f deploy/docker-compose.yml exec family-health bash

# Rebuild after pulling new code
docker compose -f deploy/docker-compose.yml build && docker compose -f deploy/docker-compose.yml up -d

# Stop
docker compose -f deploy/docker-compose.yml down

# Wipe container but keep data
docker compose -f deploy/docker-compose.yml down --rmi local
```

## Behind a reverse proxy

The container exposes plain HTTP on `3100`. For public exposure, front it with nginx / Traefik / Caddy that terminates TLS. Example nginx snippet:

```nginx
server {
  listen 443 ssl http2;
  server_name health.example.com;
  ssl_certificate     /etc/letsencrypt/live/health.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/health.example.com/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:3100;
    proxy_http_version 1.1;
    proxy_set_header Upgrade    $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host       $host;
    proxy_set_header X-Real-IP  $remote_addr;

    # SSE for /api/events — no buffering, long timeout.
    proxy_buffering off;
    proxy_read_timeout 600s;
  }
}
```

The PIN cookie is `HttpOnly + SameSite=Lax`, valid 30 days. Consider adding an additional auth layer (basic-auth, OIDC) at the proxy before exposing to the public internet.

## Troubleshooting

- **Chat says nothing back.** Attach to the tmux and check Claude output:
  ```bash
  docker compose -f deploy/docker-compose.yml exec family-health tmux attach -t health
  ```
  Usually it's expired/missing OAuth in `~/.claude`. Re-run `claude` on the host and restart the container.
- **`/api/ingest` returns 401.** `HEALTH_INGEST_SECRET` in `deploy/.env` doesn't match `data/.mcp.json`. Fix `data/.mcp.json` on the host or drop it and let the container reseed on next start.
- **Uploads not showing up.** Check that `HEALTH_DATA_DIR` is writable by the container (uid inside is root; if you volumed a host-owned dir, `chown -R $(id -u) $HEALTH_DATA_DIR` first).
