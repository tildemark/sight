# Changelog

All notable changes to the `agent-desktop` component will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-03-09

### Added
- **About Section**: Added a new About section in Settings displaying version information:
  - Agent Version
  - Tauri Version
  - Rust Version
  - Platform (OS/Architecture)
- **Developer Credits**: Added "Developed by Alfredo Sanchez Jr" with link to https://sanchez.ph
- **Runtime Server Configuration**: Changed from compile-time to runtime environment variables for server URL, allowing agents to work without rebuilds

### Changed
- Updated version to 1.1.0 in Cargo.toml and tauri.conf.json

## [1.0.3] - 2026-03-09

### Added
- **Quick Tools for End Users**: Added a collapsible "Quick Tools" section in the agent UI that allows end users to run common network commands locally when asked by IT support:
  - Flush DNS Cache
  - Release IP Address
  - Renew IP Address
  - Show WiFi SSID
  - Show Full IP Configuration
  - Ping Internet Test
- **Local Command Execution**: Added `run_local_command` Tauri command to enable local shell command execution from the agent UI.
- **Enhanced Consent Dialog Visibility**: Modified consent dialogs to bring the agent window to the front and set always-on-top, ensuring users see remote command approval requests.

## [1.0.2] - 2026-03-08

### Added
- **Server IP Fallback System**: Added an automated HTTP fallback in `ws_client.rs` to fetch a remote `--config.json` if the WebSocket fails 5 consecutive times, preventing orphaned agents from IP changes.
- **Config Persistence**: Added a resilient `config` table in the agent's internal SQLite database via `local_db.rs` to persist system-critical connection URLs.
- **Settings UI Override**: Built a "Config" tab within the internal React UI enabling IT administrators to manually check and forcefully override the central server WebSocket URL and Fallback JSON URL.

### Fixed
- **Tauri Release Start Crash**: Identified and explicitly handled strict HTTPS/WSS invariants enforced by `tauri-plugin-updater` during release builds that prevented agent auto-start.

## [1.0.1] - 2026-03-07

### Added
- **OTA Updates**: Integrated `tauri-plugin-updater` so dashboard admins can push transparent `.msi.zip` updates to edge nodes.
- **Local Agent Audit Logs**: Built a local SQLite database using `rusqlite` to permanently record all remote commands sent by IT directly within the Agent's UI for full transparency.
- **Network Telemetry**: Added IP Address, MAC Address, DHCP Enabled status, and Up/Down link speeds to the telemetry payload for better remote support context.
- **Consent Dialogs**: Added synchronous `tauri-plugin-dialog` consent prompts before executing any administrative scripts remotely.

## [1.0.0] - 2026-03-07

### Added
- **Tauri Autostart Registration**: The Tauri Agent now injects a startup registry key on Windows, auto-booting silently on PC startup.
- **Tauri System Tray**: Overrode the application window closure. The agent now runs silently in the background tray, with native Show/Quit context menus.

## [0.1.1] - 2026-03-07

### Added
- **Desktop Agent**: Initialized `agent-desktop` using Tauri v2, React, TypeScript, and Vite.
- **System Telemetry**: Created `sysinfo` Rust bindings to track Hostname, OS, live CPU utilization, RAM usage, and Primary Disk availability.
- **WebSocket Daemon**: Implemented a standalone Rust `tokio-tungstenite` WebSocket loop to constantly heartbeat geometry and systems data back to the Central Go Server.
