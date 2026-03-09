# Changelog

All notable changes to the `server` Central Go Backend will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-03-09

### Added
- **Docker Support**: Added Dockerfile for containerized deployment
- **Deployment Configs**: Added docker-compose.demo.yml and docker-compose.prod.yml for different environments

## [1.0.1] - 2026-03-07

### Changed
- **Server WebSocket Hub**: Overhauled the Go `handleWebSocket` endpoint from a simple echo server into a thread-safe `Hub` mechanism utilizing Mutexes to broadcast agent telemetry payloads to all registered Next.js dashboards simultaneously.

## [1.0.0] - 2026-03-07

### Added
- **Infrastructure**: Initialized `docker-compose.yml` for PostgreSQL, Redis, and Mosquitto MQTT broker.
- **Server**: Scaffolded the Central Go API (`server/cmd/sight/main.go`) establishing the server structure and WebSocket upgrader.
- **Database**: Set up PostgreSQL connection logic and idempotent schema migrations for `devices` and `audit_logs` tables (`server/internal/database/db.go`).
- **State Management**: Integrated Redis for scalable, real-time connection state tracking (`server/internal/state/redis.go`).
- **Messaging**: Integrated Mosquitto via Paho MQTT client for lightweight edge device telemetry ingestion (`server/internal/mqtt/broker.go`).
- **Logging**: Configured structured JSON logging using the Go standard library `log/slog` (`server/internal/logger/log.go`).
