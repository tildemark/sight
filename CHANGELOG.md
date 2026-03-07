# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-03-07

### Added
- **OTA Updates**: Integrated `tauri-plugin-updater` so dashboard admins can push transparent `.msi.zip` updates to edge nodes.
- **Local Agent Audit Logs**: Built a local SQLite database using `rusqlite` to permanently record all remote commands sent by IT directly within the Agent's UI for full transparency.
- **Network Telemetry**: Added IP Address, MAC Address, DHCP Enabled status, and Up/Down link speeds to the telemetry payload for better remote support context.
- **Consent Dialogs**: Added synchronous `tauri-plugin-dialog` consent prompts before executing any administrative scripts remotely.
- **AV Branding**: Integrated the primary brand logo across both the central Next.js dashboard and the local desktop agent application.

## [1.0.0] - 2026-03-07

### Added
- **Command Center Dashboard**: Initialized `dashboard` using Next.js 16 (App Router), React, TypeScript, and TailwindCSS v4.
- **Enterprise UI**: Implemented Shadcn UI components mapped to a dark-mode enterprise telemetry aesthetic.
- **Real-Time Telemetry Sync**: Built `useSightWebsocket.ts` React hook which establishes a persistent WSS connection to the Go server and locally caches telemetry payloads from connected edge nodes.
- **Agent Grouping**: The Dashboard automatically groups incoming agents (e.g. "Desktop Agent", "ESP32", "Android") into distinct sections.
- **Tauri Autostart Registration**: The Tauri Agent now injects a startup registry key on Windows, auto-booting silently on PC startup.
- **Tauri System Tray**: Overrode the application window closure. The agent now runs silently in the background tray, with native Show/Quit context menus.

### Changed
- **Server WebSocket Hub**: Overhauled the Go `handleWebSocket` endpoint from a simple echo server into a thread-safe `Hub` mechanism utilizing Mutexes to broadcast agent telemetry payloads to all registered Next.js dashboards simultaneously.

## [0.1.1] - 2026-03-07

### Added
- **Desktop Agent**: Initialized `agent-desktop` using Tauri v2, React, TypeScript, and Vite.
- **Frontend UI**: Built the modern command center UI with Shadcn UI and TailwindCSS v3.
- **System Telemetry**: Created `sysinfo` Rust bindings to track Hostname, OS, live CPU utilization, RAM usage, and Primary Disk availability.
- **WebSocket Daemon**: Implemented a standalone Rust `tokio-tungstenite` WebSocket loop to constantly heartbeat geometry and systems data back to the Central Go Server.

## [0.1.0] - 2026-03-07

### Added
- **Infrastructure**: Initialized `docker-compose.yml` for PostgreSQL, Redis, and Mosquitto MQTT broker.
- **Server**: Scaffolded the Central Go API (`server/cmd/sight/main.go`) establishing the server structure and WebSocket upgrader.
- **Database**: Set up PostgreSQL connection logic and idempotent schema migrations for `devices` and `audit_logs` tables (`server/internal/database/db.go`).
- **State Management**: Integrated Redis for scalable, real-time connection state tracking (`server/internal/state/redis.go`).
- **Messaging**: Integrated Mosquitto via Paho MQTT client for lightweight edge device telemetry ingestion (`server/internal/mqtt/broker.go`).
- **Logging**: Configured structured JSON logging using the Go standard library `log/slog` (`server/internal/logger/log.go`).
