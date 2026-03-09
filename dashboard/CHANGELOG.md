# Changelog

All notable changes to the `dashboard` Next.js frontend will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.2] - 2026-03-09

### Added
- **Network & System Admin Commands**: Added a new "Network & System Admin" panel in the expanded agent view with the following remote execution commands:
  - Restart Windows Explorer
  - Show WiFi SSID (netsh wlan show interfaces)
  - Open Task Manager
  - View Application Logs (last 50 event log entries)
  - DNS Lookup (prompts for domain)
  - Trace Route (prompts for target)
  - Release IP Address (ipconfig /release)
  - Renew IP Address (ipconfig /renew)
  - Reset Network Stack (netsh winsock reset)
  - Reset TCP/IP Stack (netsh int ip reset)
  - Search Installed Applications (prompts for app name)

## [1.0.1] - 2026-03-07

### Added
- **AV Branding**: Integrated the primary brand logo across the central Next.js dashboard header.

## [1.0.0] - 2026-03-07

### Added
- **Command Center Dashboard**: Initialized `dashboard` using Next.js 16 (App Router), React, TypeScript, and TailwindCSS v4.
- **Enterprise UI**: Implemented Shadcn UI components mapped to a dark-mode enterprise telemetry aesthetic.
- **Real-Time Telemetry Sync**: Built `useSightWebsocket.ts` React hook which establishes a persistent WSS connection to the Go server and locally caches telemetry payloads from connected edge nodes.
- **Agent Grouping**: The Dashboard automatically groups incoming agents (e.g. "Desktop Agent", "ESP32", "Android") into distinct sections.
