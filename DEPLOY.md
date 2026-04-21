# Deploying InfluConnect to a server with an existing Caddy

This guide wires InfluConnect (Django + React) behind the **Caddy container you
already run for heritage-exclusive.com / WordPress**. No extra proxy, no port
conflict — the existing Caddy on :80 / :443 also serves `influconnect.fr`.

## 1. Point your DNS

Create two A (or AAAA) records pointing to the server's public IP:

```
influconnect.fr        A   <server-ip>
www.influconnect.fr    A   <server-ip>
```

Wait until `dig +short influconnect.fr` returns your server IP before
continuing (Caddy needs DNS to obtain the Let's Encrypt cert).

## 2. Create the shared Docker network

Caddy needs to reach the InfluConnect containers over Docker's bridge. We use an
external network named `proxy` that both stacks attach to.

```bash
docker network create proxy
```

Attach your **existing Caddy container** to it (one-time — the attachment
survives restarts):

```bash
docker network connect proxy wordpress-caddy-1
```

(If you prefer, edit the WordPress `docker-compose.yml` to declare the `proxy`
network as external and add it to the `caddy` service, then `docker compose up -d`.)

## 3. Upload the project

On the server (e.g. `/opt/influconnect`):

```bash
sudo mkdir -p /opt/influconnect && sudo chown $USER /opt/influconnect
cd /opt/influconnect
git clone <your repo url> .
```

## 4. Configure environment

```bash
cp .env.prod.example .env.prod
# Generate secrets:
python3 -c "import secrets; print(secrets.token_urlsafe(64))"            # -> SECRET_KEY
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"  # -> FERNET_KEY
# then edit .env.prod with the values above, DB password, SMTP, Stripe, etc.
nano .env.prod
```

## 5. Build & launch the stack

```bash
docker compose -p influconnect -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

The `-p influconnect` flag fixes the project name so container names are
predictable (`influconnect-backend-1`, `influconnect-frontend-1`, `influconnect-db-1`).

Check everything is up:

```bash
docker compose -p influconnect -f docker-compose.prod.yml ps
docker compose -p influconnect -f docker-compose.prod.yml logs -f backend
```

Create the Django admin user:

```bash
docker compose -p influconnect -f docker-compose.prod.yml exec backend \
    python manage.py createsuperuser
```

## 6. Add the Caddy virtual host

Append the contents of [`deploy/Caddyfile.snippet`](Caddyfile.snippet) to the
Caddyfile your existing Caddy container uses (typically
`/etc/caddy/Caddyfile` or mounted from the WordPress compose). Then reload:

```bash
docker exec wordpress-caddy-1 caddy reload --config /etc/caddy/Caddyfile
```

Caddy will automatically issue a Let's Encrypt certificate for `influconnect.fr`
and `www.influconnect.fr` on first request.

## 7. Smoke test

```bash
curl -I https://influconnect.fr/                 # 200 — SPA
curl -I https://influconnect.fr/api/reference/plans/   # 200 — JSON
curl -I https://influconnect.fr/admin/           # 302 — Django admin
```

Then open `https://influconnect.fr` in a browser.

## Updates

```bash
cd /opt/influconnect
git pull
docker compose -p influconnect -f docker-compose.prod.yml --env-file .env.prod up -d --build
# Migrations run automatically via the compose `command:` block.
```

## Backups (Postgres)

```bash
docker compose -p influconnect -f docker-compose.prod.yml exec -T db \
    pg_dump -U influconnect influconnect | gzip > backup-$(date +%F).sql.gz
```

## Troubleshooting

- **502 from Caddy** → the `proxy` network doesn't include the Caddy container.
  Run `docker network inspect proxy` and check both `wordpress-caddy-1` and
  `influconnect-backend-1` are listed.
- **CSRF errors on /admin** → add your hostname to `CSRF_TRUSTED_ORIGINS` in
  `.env.prod` (full `https://…` URLs, comma separated).
- **"ALLOWED_HOSTS" 400** → same, extend `ALLOWED_HOSTS` in `.env.prod`.
- **Static files missing** → rebuild the backend image:
  `docker compose -p influconnect -f docker-compose.prod.yml build backend`.
