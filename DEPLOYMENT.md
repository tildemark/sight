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

2. **Deploy Demo Stack**:
   ```bash
   docker-compose -f docker-compose.demo.yml up -d
   ```

3. **Configure Nginx Proxy Manager**:
   - Create Proxy Host: `sight.sanchez.ph` → `landing:80`
   - Create Proxy Host: `sight.sanchez.ph/dashboard` → `dashboard:3000` (with path `/` → `/`)
   - Enable WebSocket support for the dashboard

4. **Upload Agent MSI**:
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

### Agent Connection Issues
1. Check if server is running: `docker ps`
2. Check server logs: `docker logs sight-server`
3. Verify WebSocket endpoint: `wss://your-server/ws`
4. Check firewall rules

### WebSocket Not Working
1. Ensure Nginx Proxy Manager has WebSocket support enabled
2. Check proxy headers:
   ```
   Proxy-Timeout: 900
   Proxy-Body-Size: 0
   ```
3. Verify Sophos allows WebSocket connections

### Database Connection
1. Check PostgreSQL logs: `docker logs sight-postgres`
2. Verify connection string in server environment
3. Ensure network connectivity between containers

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
