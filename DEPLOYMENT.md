# Sight Deployment Guide

This document covers the deployment of the Sight remote agent management system to two environments:
- **Demo Server** (sight.sanchez.ph) - Public demo with landing page
- **Production Server** (sight.avegabros.org) - Company internal use

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         DEMO SERVER                              │
│                      sight.sanchez.ph                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌──────────────────┐   │
│  │   Landing   │───▶│  Dashboard  │───▶│  Go Server       │   │
│  │   (Nginx)   │    │  (Next.js)  │    │  (WebSocket)     │   │
│  │   :3101     │    │   :3100     │    │    :8180         │   │
│  └─────────────┘    └─────────────┘    └──────────────────┘   │
│         │                                      │               │
│  ┌──────┴──────┐                        ┌─────┴─────┐         │
│  │ config.json │                        │ PostgreSQL │         │
│  │ (server_url)│                        │   :5545    │         │
│  └─────────────┘                        └────────────┘         │
│                                                  │               │
│                                           ┌──────┴──────┐        │
│                                           │   Redis    │        │
│                                           │   :6485    │        │
│                                           └────────────┘        │
│                                           ┌────────────┐         │
│                                           │ Mosquitto │         │
│                                           │  :2883    │         │
│                                           └───────────┘         │
└─────────────────────────────────────────────────────────────────┘

Agent (MSI) ─────────────────────────────────────────────────▶
Pre-configured to connect to: wss://sight.sanchez.ph/ws
```

---

## Network Requirements

### Demo Server (OCI Ampere)
- **Public IP**: Assigned by OCI
- **Required Ports**:
   - 80/443 (existing reverse proxy)
   - 3101 (Landing)
   - 3100 (Dashboard)
   - 8180 (Go Server - WebSocket)
   - 5545 (PostgreSQL)
   - 6485 (Redis)
   - 2883/9901 (Mosquitto MQTT)

### Production Server (Company Intranet)
- **Public IP**: Via Sophos Firewall
- **Internal IP**: LAN-accessible
- **Required Ports** (to open on Sophos):
  - 80/443 (Dashboard)
  - 8080 (Go Server - WebSocket)
  - 5445 (PostgreSQL) - internal only
  - 6385 (Redis) - internal only
  - 1883/9001 (Mosquitto MQTT)

### Sophos Firewall Configuration
For production, configure the following port forwards on Sophos:
```
WAN → Server Public IP:
  - TCP 443 → 192.168.x.x:443 (HTTPS)
  - TCP 80  → 192.168.x.x:80  (HTTP)
  - TCP 8443 → 192.168.x.x:8080 (WebSocket)

LAN → Internal:
  - Allow all traffic between LAN and Server subnet
```

---

## Agent Configuration

The agent MSI is pre-configured to connect to a specific server:

| Environment | Server URL | Fallback URL |
|------------|------------|--------------|
| Demo | wss://sight.sanchez.ph/ws | https://sight.sanchez.ph/config.json |
| Production | wss://sight.avegabros.org/ws | https://sight.avegabros.org/config.json |

The agent stores these settings in a local SQLite database and can be changed via Settings.

---

## Build Instructions

### Prerequisites
- Node.js 20+
- Rust 1.70+
- npm

### Building Demo Agent
```bash
cd agent-desktop
npm install
npm run tauri build -- --env SIGHT_SERVER_URL=wss://sight.sanchez.ph/ws --env SIGHT_FALLBACK_URL=https://sight.sanchez.ph/config.json
```

Or use the build script:
```bash
scripts\build-demo-agent.bat
```

### Building Production Agent
```bash
cd agent-desktop
npm install
npm run tauri build -- --env SIGHT_SERVER_URL=wss://sight.avegabros.org/ws --env SIGHT_FALLBACK_URL=https://sight.avegabros.org/config.json
```

Or use the build script:
```bash
scripts\build-prod-agent.bat
```

---

## Deployment Steps

### Demo Server (sight.sanchez.ph)

1. **Create Docker Network** (if not exists):
   ```bash
   docker network create net
   ```

2. **Check for port conflicts before deploying**:
   ```bash
   sudo ss -tulpen | grep -E ':(3100|3101|8180|5545|6485|2883|9901)\b'
   docker ps --format "table {{.Names}}\t{{.Ports}}"
   ```

3. **Deploy Demo Stack via Portainer**:
   - Stack → Add Stack → Repository
   - Compose path: `docker-compose.demo.yml`
   - Enable Pull and redeploy
   - The `net` external network **must exist first** or deploy will fail

   Or via CLI:
   ```bash
   docker compose -f docker-compose.demo.yml up -d --build
   ```

4. **Verify all containers are running** (sight-server and sight-mosquitto are the usual culprits):
   ```bash
   docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
   docker logs sight-server --tail 20
   docker logs sight-mosquitto --tail 20
   ```

5. **Configure Nginx Proxy Manager**:

   Create **one** proxy host for `sight.sanchez.ph`:

   **Details tab:**
   - Domain: `sight.sanchez.ph`
   - Scheme: `http`
   - Forward Hostname/IP: `sight-landing` (container name, NOT localhost)
   - Forward Port: `80` (container port, NOT host port 3101)
   - Block Common Exploits: enabled

   > ⚠️ NPM runs inside Docker on the `net` network. Always use container names and
   > internal container ports for Forward Hostname/IP and Port, not host-mapped ports.

   **Advanced tab (global, gear icon top-right):**
   ```nginx
   location = /dashboard {
     return 301 /dashboard/;
   }

   location ^~ /dashboard/ {
     proxy_pass http://sight-dashboard:3000/;
     proxy_set_header Host $host;
     proxy_set_header X-Real-IP $remote_addr;
     proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
     proxy_set_header X-Forwarded-Proto $scheme;
   }

   location ^~ /ws {
     proxy_pass http://sight-server:8080;
     proxy_http_version 1.1;
     proxy_set_header Upgrade $http_upgrade;
     proxy_set_header Connection "upgrade";
     proxy_set_header Host $host;
     proxy_set_header X-Real-IP $remote_addr;
     proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
     proxy_set_header X-Forwarded-Proto $scheme;
     proxy_read_timeout 900s;
     proxy_send_timeout 900s;
   }
   ```

   > ⚠️ Do NOT use Custom Locations for /dashboard — NPM Custom Locations do not
   > support leading-slash path matching reliably. Use the global Advanced block above.

   **SSL tab:**
   - Request Let's Encrypt cert for `sight.sanchez.ph`
   - Enable Force SSL
   - Save

   Verify nginx config was written:
   ```bash
   docker exec npm sh -c "grep -R 'server_name sight.sanchez.ph' /data/nginx/proxy_host"
   ```
   If this returns nothing, the proxy host domain was not saved with that exact name — delete and recreate.

6. **Upload Agent MSI**:
   - Build the demo agent
   - Place in: `server/releases/agent-desktop_1.0.x_x64_en-US.msi`
   - Update landing page download link

### Production Server (sight.avegabros.org)

1. **Create Docker Network**:
   ```bash
   docker network create net
   ```

2. **Deploy Production Stack**:
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

3. **Configure Sophos Firewall**:
   - Create port forward rules for ports 80, 443, 8080
   - Create firewall policy allowing traffic

4. **Configure Nginx Proxy Manager** (if used):
   - Create Proxy Host: `sight.avegabros.org` → `dashboard:3000`

5. **Internal Distribution**:
   - Deploy agent via GPO, SCCM, or manual install
   - MSI automatically connects to production server

---

## Docker Services

### Demo Stack Services
| Service | Container | Port | Description |
|---------|-----------|------|-------------|
| Landing | sight-landing | 3101 | Nginx serving landing page |
| Dashboard | sight-dashboard | 3100 | Next.js web UI |
| Server | sight-server | 8180 | Go WebSocket server |
| PostgreSQL | sight-postgres | 5545 | Database |
| Redis | sight-redis | 6485 | Cache/Sessions |
| Mosquitto | sight-mosquitto | 2883/9901 | MQTT broker |

### Production Stack Services
Same as demo, minus the landing page container.

---

## Troubleshooting

### Port Conflicts on a Shared Server
If other apps already use standard ports, use these commands to check before deploying:
```bash
sudo ss -tulpen | grep -E ':(80|443|3000|3001|8080|5432|6379|1883)\b'
docker ps --format "table {{.Names}}\t{{.Ports}}"
```
The demo stack uses non-conflicting host ports: `3101`, `3100`, `8180`, `5545`, `6485`, `2883`, `9901`.
Containers still communicate on their original internal ports.

---

### Portainer Git Deploy — Build Failures

**`nginx.conf not found` during landing build**
- Cause: `landing` service `build.context` was set to repo root (`.`) instead of `./landing`
- Fix: Set `context: ./landing` and `dockerfile: Dockerfile` in `docker-compose.demo.yml`

**`npm ci` exit code 1 during dashboard build**
- Cause: Dashboard Dockerfile had a runtime stage that ran `npm ci` without copying `package.json`
- Fix: Remove the runtime `RUN npm ci` — Next.js standalone output (`output: "standalone"`) does not need it

**Mosquitto `Unable to open config file` / `not a directory` mount error**
- Cause: Portainer creates a directory at the bind-mount source path if it doesn't exist, causing a dir→file type mismatch
- Fix: Use a custom built image with config baked in (`mosquitto/Dockerfile`) instead of bind-mounting the conf file

---

### sight-server Crash Loop — PostgreSQL Connection Refused
Symptom in logs: `dial tcp [::1]:5445: connect: connection refused`
- Cause: `cmd/sight/main.go` had hardcoded `localhost` instead of reading `DATABASE_URL` env var
- Fix: Read from environment variables with localhost fallback:
  ```go
  pgURI := os.Getenv("DATABASE_URL")
  if pgURI == "" { pgURI = "postgres://...@localhost:5445/..." }
  ```
- Also: `REDIS_URL` from compose has `redis://` prefix — strip it before passing to go-redis:
  ```go
  if strings.HasPrefix(redisAddr, "redis://") { redisAddr = redisAddr[8:] }
  ```

---

### HTTP 525 SSL Handshake Failed (Cloudflare)
Symptom: `TLSv1.3 (IN), TLS alert, unrecognized name (624)`

**Step 1 — Confirm NPM has no config for the domain:**
```bash
docker exec npm sh -c "grep -R 'server_name sight.sanchez.ph' -n /data/nginx/proxy_host"
```
If nothing returns, the proxy host was never saved with that exact domain name. Delete and recreate it.

**Step 2 — Confirm NPM cert exists:**
```bash
docker exec npm sh -c "ls /etc/letsencrypt/live"
```
Look for the cert folder (e.g. `npm-19`). If missing, request a new Let's Encrypt cert in NPM SSL tab.

**Step 3 — If using Cloudflare proxy, set SSL mode to `Full` or `Full (strict)`.**

**Step 4 — Test TLS from origin directly:**
```bash
curl -vk --resolve sight.sanchez.ph:443:127.0.0.1 https://sight.sanchez.ph/
```
Should return HTTP 200, not `unrecognized name`.

---

### NPM Proxy to Containers — localhost Does Not Work
- NPM runs inside Docker. `localhost` inside NPM resolves to the NPM container itself, not the host.
- Always use **container names** as Forward Hostname (e.g. `sight-landing`, `sight-dashboard`, `sight-server`)
- Always use **internal container ports**, not host-mapped ports:
  - `sight-landing` → port `80` (not `3101`)
  - `sight-dashboard` → port `3000` (not `3100`)
  - `sight-server` → port `8080` (not `8180`)
- Containers must be on the **same Docker network** as NPM (the `net` network)
- Verify connectivity:
  ```bash
  docker exec npm curl -s http://sight-landing:80 | head -5
  docker inspect npm | grep -A5 Networks
  docker inspect sight-landing | grep -A5 Networks
  ```

---

### Dashboard Shows Landing Page
- Cause 1: Custom Location was typed as `dashboard` (no leading slash). NPM requires `/dashboard`.
- Cause 2: NPM Custom Locations don't reliably strip the path prefix before proxying.
- Fix: Use the **global Advanced block** in the proxy host (top-right gear icon), not Custom Locations:
  ```nginx
  location ^~ /dashboard/ {
    proxy_pass http://sight-dashboard:3000/;
    ...
  }
  ```

---

### Dashboard Loads But No CSS/JS (Unstyled Page)
- Cause: Next.js generates asset URLs as `/_next/static/...` which NPM routes to the landing container, not the dashboard.
- Fix: Set `basePath` and `assetPrefix` in `dashboard/next.config.ts`:
  ```ts
  const nextConfig: NextConfig = {
    output: "standalone",
    basePath: "/dashboard",
    assetPrefix: "/dashboard",
  };
  ```
  This makes Next.js emit `/dashboard/_next/static/...` URLs which correctly route to the dashboard proxy location.
  Requires a full image rebuild after changing this config.

---

### Agent Connection Issues
1. Check all containers are up: `docker ps --format "table {{.Names}}\t{{.Status}}"`
2. Check server logs: `docker logs sight-server --tail 50`
3. Verify WebSocket endpoint is reachable: `wss://sight.sanchez.ph/ws`
4. Test WebSocket from browser console: `new WebSocket('wss://sight.sanchez.ph/ws')`
5. Confirm `/ws` NPM location has websocket upgrade headers (see NPM config above)

---

### Database Connection
1. Check PostgreSQL logs: `docker logs sight-postgres`
2. Confirm `DATABASE_URL` env var is being read by server (check `docker logs sight-server`)
3. Verify containers are on the same `net` network

---

## Security Considerations

1. **SSL/TLS**: Enable HTTPS via Nginx Proxy Manager
2. **Firewall**: Only expose necessary ports (80, 443, 8080)
3. **Database**: Use strong passwords, restrict to internal network
4. **Agent**: Agents authenticate via unique IDs - implement token-based auth if needed

---

## Support

For issues, check:
- Server logs: `docker logs <container>`
- Agent logs: Check %APPDATA%\com.tilde.agent-desktop\
- Network: Verify port accessibility via telnet/nc
