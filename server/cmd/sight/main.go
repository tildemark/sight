package main

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"sight/internal/database"
	"sight/internal/logger"
	"sight/internal/mqtt"
	"sight/internal/state"

	"github.com/gorilla/websocket"
)

// Generic JSON wrapper for all WebSocket communications
type WebSocketMessage struct {
	Type           string          `json:"type"`
	TargetHostname string          `json:"target_hostname,omitempty"`
	Action         string          `json:"action,omitempty"`
	Payload        json.RawMessage `json:"payload,omitempty"`
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for dev
	},
}

// Hub maintains the set of active clients and broadcasts messages to the clients.
type Hub struct {
	clients    map[*websocket.Conn]bool
	broadcast  chan []byte
	register   chan *websocket.Conn
	unregister chan *websocket.Conn
	mu         sync.Mutex
}

func newHub() *Hub {
	return &Hub{
		broadcast:  make(chan []byte),
		register:   make(chan *websocket.Conn),
		unregister: make(chan *websocket.Conn),
		clients:    make(map[*websocket.Conn]bool),
	}
}

func (h *Hub) run(log *logger.Logger) {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()
			log.Info("Client registered")
		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				client.Close()
				log.Info("Client unregistered")
			}
			h.mu.Unlock()
		case message := <-h.broadcast:
			h.mu.Lock()
			for client := range h.clients {
				err := client.WriteMessage(websocket.TextMessage, message)
				if err != nil {
					log.Error("Failed to write to client", "error", err)
					client.Close()
					delete(h.clients, client)
				}
			}
			h.mu.Unlock()
		}
	}
}

func main() {
	log := logger.NewLogger()
	log.Info("Starting Project S.I.G.H.T. Central Server...")

	// Initialize Configuration
	pgURI := "postgres://sight_admin:sight_password@localhost:5445/sight_db?sslmode=disable"
	redisAddr := "localhost:6385"
	mqttBroker := "tcp://localhost:1883"

	// 1. Initialize PostgreSQL
	db, err := database.New(pgURI, log)
	if err != nil {
		log.Error("Failed to connect to PostgreSQL", "error", err)
		os.Exit(1)
	}
	defer db.Close()
	log.Info("Connected to PostgreSQL")

	// 2. Initialize Redis
	redisClient, err := state.NewRedisClient(redisAddr, "", 0, log)
	if err != nil {
		log.Error("Failed to connect to Redis", "error", err)
		os.Exit(1)
	}
	defer redisClient.Close()
	log.Info("Connected to Redis")

	// 3. Initialize MQTT Broker
	mqttClient, err := mqtt.NewClient(mqttBroker, "sight_central_server", log)
	if err != nil {
		log.Error("Failed to connect to Mosquitto", "error", err)
		os.Exit(1)
	}
	defer mqttClient.Disconnect()
	log.Info("Connected to Mosquitto")

	// Setup WebSocket Hub
	hub := newHub()
	go hub.run(log)

	// Setup HTTP/WebSocket Routes
	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		handleWebSocket(hub, w, r, log, db)
	})

	http.HandleFunc("/api/logs", func(w http.ResponseWriter, r *http.Request) {
		// Allow CORS for local dev dashboard
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Content-Type", "application/json")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		logs, err := db.GetAuditLogs(50)
		if err != nil {
			log.Error("Failed to fetch audit logs", "error", err)
			http.Error(w, `{"error": "Failed to fetch audit logs"}`, http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(logs)
	})

	// Tauri Auto-Updater Endpoint
	http.HandleFunc("/api/updater/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Content-Type", "application/json")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		// In a real app, you would parse the path to check the target and current_version.
		// For now, we'll just serve a static updater.json from the releases folder if it exists.
		updaterFile := "./releases/updater.json"
		if _, err := os.Stat(updaterFile); err == nil {
			http.ServeFile(w, r, updaterFile)
			return
		}

		w.WriteHeader(http.StatusNoContent) // No update available
	})

	// Static File Server for Updater Binaries
	fs := http.FileServer(http.Dir("./releases"))
	http.Handle("/downloads/", http.StripPrefix("/downloads/", fs))

	server := &http.Server{
		Addr:    ":8080",
		Handler: nil, // uses default serve mux
	}

	// Graceful Shutdown Setup
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	go func() {
		log.Info("Server listening on :8080")
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Error("HTTP server error", "error", err)
		}
	}()

	<-stop
	log.Info("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := server.Shutdown(ctx); err != nil {
		log.Error("Server shutdown failed", "error", err)
	}
	log.Info("Server exited properly")
}

func handleWebSocket(hub *Hub, w http.ResponseWriter, r *http.Request, log *logger.Logger, db *database.DB) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Error("WebSocket upgrade failed", "error", err)
		return
	}

	hub.register <- conn

	defer func() {
		hub.unregister <- conn
	}()

	log.Info("New client connected", "remote_addr", conn.RemoteAddr().String())

	for {
		_, p, err := conn.ReadMessage()
		if err != nil {
			log.Info("Client disconnected", "remote_addr", conn.RemoteAddr().String(), "error", err)
			return
		}

		log.Debug("Received raw websocket bytes", "length", len(p))

		var msg WebSocketMessage
		if err := json.Unmarshal(p, &msg); err != nil {
			log.Error("Failed to parse incoming websocket payload as JSON", "error", err, "raw", string(p))
			continue
		}

		if msg.Type == "TELEMETRY" {
			// Broadcast telemetry updates to all dashboards
			hub.broadcast <- p
		} else if msg.Type == "COMMAND" {
			log.Info("Received Remote Command Execution Request", "target", msg.TargetHostname, "action", msg.Action)
			// Log the command invocation attempt
			db.LogAuditCommand(msg.TargetHostname, msg.Action, false, "Command sent to target agent (awaiting result)")
			// Broadcast the command so the specific target agent can pick it up
			hub.broadcast <- p
		} else if msg.Type == "COMMAND_RESULT" {
			log.Info("Received Remote Command Execution Result", "target", msg.TargetHostname, "action", msg.Action)

			// Parse the inner payload slightly to extract success for the audit log
			var payload struct {
				Success bool   `json:"success"`
				Output  string `json:"output"`
			}

			if err := json.Unmarshal(msg.Payload, &payload); err == nil {
				db.LogAuditCommand(msg.TargetHostname, msg.Action, payload.Success, payload.Output)
			} else {
				log.Error("Failed to parse COMMAND_RESULT payload", "error", err)
			}

			// We can also broadcast this so the dashboard sees it if needed
			hub.broadcast <- p
		} else {
			log.Warn("Unknown WebSocket Message Type", "type", msg.Type)
		}
	}
}
