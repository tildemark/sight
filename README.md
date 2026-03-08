# Project S.I.G.H.T. 👁️
**System Inspection and Global Hardware Telemetry**

An enterprise-grade, multi-protocol IT monitoring and remote troubleshooting hub. Project S.I.G.H.T. aggregates telemetry from employee PCs, Android mobile devices, network infrastructure, NVRs, and IoT edge devices into a unified, real-time command center. Designed to sit alongside internal systems to provide IT administrators with total visibility and instant remediation tools.



## 🚀 Features

* **Real-Time PC Telemetry:** Lightweight Tauri/Rust desktop agents provide instant visibility into CPU, RAM, and network health via persistent WebSockets.
* **Android Edge Nodes:** Tauri v2 mobile apps utilize ultra-lightweight MQTT heartbeats to report battery and network status without draining resources.
* **Network & NVR Monitoring:** Native SNMP integration for polling enterprise switches and Access Points, plus HTTP polling for NVR health checks.
* **IoT Support:** Full MQTT broker integration for monitoring sensors and headless edge devices.
* **Privacy-First Remediation:** Push commands directly from the dashboard to client PCs, guarded by an interactive user-consent handshake.
* **Live Support Chat:** Real-time, bi-directional WebSocket chat connecting employees directly to IT support.
* **Immutable Audit Trails:** Every command, chat message, and consent request is permanently logged in PostgreSQL for strict compliance.

## 🛠️ Technology Stack

| Component | Technology |
| :--- | :--- |
| **Desktop / Mobile Agents** | Tauri v2, Rust, React, Tailwind, Shadcn UI |
| **Admin Dashboard** | Next.js, React, Tailwind CSS, Shadcn UI |
| **Central Server** | Go (Golang), WebSockets, SNMP |
| **Databases** | PostgreSQL (Relational), Redis (In-Memory State) |
| **IoT & Mobile Messaging** | Mosquitto (MQTT), Firebase Cloud Messaging (FCM) |

## 🗺️ Development Roadmap & Progress Tracker

Use this section to track the implementation of each architectural phase.

### Phase 1: Foundation & Core Infrastructure
- [x] Initialize PostgreSQL database and design schemas (`devices`, `audit_logs`).
- [x] Spin up Redis for real-time active connection tracking.
- [x] Deploy Mosquitto MQTT broker for edge device messaging.
- [x] Scaffold the Central Go API and configure the WebSocket upgrader.
- [x] Implement robust error handling and structured logging in Go.

### Phase 2: The Tauri Desktop Agent (The MVP)
- [x] Initialize Tauri v2 project with React, Tailwind, and Shadcn UI.
- [x] Implement Rust `sysinfo` crate to gather CPU, RAM, and network data.
- [x] Establish secure WSS connection from the Rust backend to the Go server.
- [x] Build the system tray UI and basic IT support request form.
- [x] Implement listener in Rust for secure remote execution commands.

### Phase 3: The Command Center Dashboard
- [x] Scaffold Next.js web application with Shadcn UI components.
- [x] Build the main data table to display connected agents and health statuses.
- [x] Integrate with the Go server's REST/WSS APIs to ingest real-time telemetry.
- [x] Build the remote command UI (e.g., action buttons for "Flush DNS", "Restart Spooler").
- [x] Integrate the UI with the existing IT ticketing API (proxying through the Go server).

### Phase 4: Remote Action Execution & Infrastructure
- [x] Enforce Administrator (`requireAdministrator`) execution level on Windows Tauri builds.
- [x] Update Go Central Server to parse generic `{type, payload}` messages instead of raw telemetry bytes.
- [x] Add bi-directional command routing to the Go WebSocket Hub.
- [x] Create Rust Listener in `agent-desktop` to intercept `"COMMAND"` payloads and use `std::process::Command` to execute them.
- [x] Build "Execute Node Actions" remote UI buttons into Dashboard `AgentTable`.

### Phase 4.1: Dashboard UI Refactor & Expanded Commands
- [x] Redesign `AgentTable` to utilize master-detail collapsible sub-rows.
- [x] Relocate granular hardware gauges into the expanded detail view to declutter the master list.
- [x] Expand the Rust command engine to handle `shutdown /r /t 0` and network pings.
- [x] Implement a command payload that securely self-restarts the Tauri agent process.

### Phase 4.2: Logging & Audit Compliance
- [ ] Establish local SQLite logging in the Tauri agent for offline audit trails.
- [ ] Connect agent logs to the Go central server for centralized compliance tracking.
- [ ] Build the "Activity History" UI tab in the agent desktop application.
- [ ] Implement database synchronization for log ingestion when agents reconnect.

### Phase 5: Network Gear & NVR Integration
- [ ] Add an SNMP polling engine to the Go Central API.
- [ ] Configure SNMP queries for switches, firewalls, and Access Points (port status, bandwidth).
- [ ] Write HTTP/REST jobs in Go to poll NVR endpoints for drive health and camera status.
- [ ] Update the Next.js dashboard to visualize network infrastructure health.

### Phase 6: IoT & Edge Devices
- [ ] Write C++/Python telemetry scripts for ESP32/Raspberry Pi edge devices.
- [ ] Configure edge devices to publish statuses to the MQTT broker.
- [ ] Subscribe the Go server to relevant MQTT topics and parse incoming telemetry.
- [ ] Correlate edge device data with network alerts in the Next.js dashboard.

### Phase 7: Real-Time Support Chat
- [ ] Define the `CHAT_MESSAGE` JSON payload structure.
- [ ] Update the Go WebSocket router to handle bi-directional message brokering.
- [ ] Create the `support_chats` PostgreSQL table for audit compliance.
- [ ] Build the chat interface in the Tauri agent using Shadcn components.
- [ ] Build the split-pane support chat UI in the Next.js admin dashboard.

### Phase 8: The Android Edge Node
- [ ] Configure Tauri v2 for Android deployment (`.apk`).
- [ ] Install and configure Tauri mobile plugins (`plugin-notification`, `plugin-os`).
- [ ] Implement MQTT heartbeat logic using Android's WorkManager API.
- [ ] Integrate Firebase Cloud Messaging (FCM) in the Go server for push notifications.
- [ ] Build the mobile-responsive UI for ticketing and support chat.

## 🏁 Getting Started

### Prerequisites
* [Rust Toolchain](https://rustup.rs/)
* [Node.js](https://nodejs.org/) (v18+)
* [Go](https://go.dev/) (v1.21+)
* PostgreSQL, Redis, and Mosquitto MQTT Broker

### Installation (Development)

1. **Clone the repository:**
   ```bash
   git clone git@git.sanchez.ph:admin/project-sight.git
   cd project-sight

```

2. **Start the Central Go Server:**
```bash
cd server
go mod tidy
go run cmd/sight/main.go

```


3. **Launch the Admin Dashboard:**
```bash
cd dashboard
npm install
npm run dev

```


4. **Run the Tauri Desktop Agent:**
```bash
cd agent-desktop
npm install
npm run tauri dev

```



## 🔒 Security & Privacy

* All communication between agents and the server is encrypted via TLS/WSS.
* Remote command execution strictly requires user consent via UI prompts.
* API keys for third-party systems are held entirely server-side.


