package database

import (
	"database/sql"
	"fmt"

	"sight/internal/logger"

	_ "github.com/lib/pq"
)

type DB struct {
	*sql.DB
	log *logger.Logger
}

func New(connectionString string, log *logger.Logger) (*DB, error) {
	db, err := sql.Open("postgres", connectionString)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	instance := &DB{DB: db, log: log}

	if err := instance.migrate(); err != nil {
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}

	return instance, nil
}

func (db *DB) migrate() error {
	db.log.Info("Running database migrations...")

	// Using basic SQL for initial schema creation (idempotent)
	schema := `
	CREATE TABLE IF NOT EXISTS devices (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		hostname VARCHAR(255) NOT NULL,
		os_type VARCHAR(50) NOT NULL,
		mac_address VARCHAR(17) UNIQUE NOT NULL,
		last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
		status VARCHAR(50) DEFAULT 'offline'
	);

	CREATE TABLE IF NOT EXISTS audit_logs (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		device_id UUID REFERENCES devices(id),
		action VARCHAR(255) NOT NULL,
		details JSONB,
		timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
		success BOOLEAN NOT NULL
	);
	`

	_, err := db.Exec(schema)
	if err != nil {
		return err
	}

	db.log.Info("Database migrations completed successfully")
	return nil
}

func (db *DB) LogAuditCommand(hostname string, action string, success bool, details string) error {
	// First, lookup the device_id
	var deviceID string
	err := db.QueryRow("SELECT id FROM devices WHERE hostname = $1", hostname).Scan(&deviceID)
	if err != nil {
		if err == sql.ErrNoRows {
			db.log.Info("Device not found, auto-registering", "hostname", hostname)
			// Auto-register the device to satisfy the foreign key constraint
			insertDevQuery := `INSERT INTO devices (hostname, os_type, mac_address, status) VALUES ($1, 'Unknown', gen_random_uuid()::varchar(17), 'online') RETURNING id`
			if err := db.QueryRow(insertDevQuery, hostname).Scan(&deviceID); err != nil {
				db.log.Error("Failed to auto-register device", "error", err)
				return fmt.Errorf("failed to auto-register device: %w", err)
			}
		} else {
			return fmt.Errorf("failed to lookup device: %w", err)
		}
	}

	// Insert the audit log
	query := `
		INSERT INTO audit_logs (device_id, action, success, details)
		VALUES ($1, $2, $3, $4)
	`
	// Use a basic JSON structure for details if it's just a string message
	detailsJSON := fmt.Sprintf(`{"output": %q}`, details)

	_, err = db.Exec(query, deviceID, action, success, detailsJSON)
	if err != nil {
		db.log.Error("Failed to insert audit log", "error", err)
		return fmt.Errorf("failed to insert audit log: %w", err)
	}

	db.log.Info("Audit log recorded", "hostname", hostname, "action", action, "success", success)
	return nil
}

type AuditLogEntry struct {
	ID        string `json:"id"`
	Hostname  string `json:"hostname"`
	Action    string `json:"action"`
	Success   bool   `json:"success"`
	Details   string `json:"details"`
	Timestamp string `json:"timestamp"`
}

func (db *DB) GetAuditLogs(limit int) ([]AuditLogEntry, error) {
	query := `
		SELECT 
			a.id, 
			d.hostname, 
			a.action, 
			a.success, 
			a.details, 
			a.timestamp
		FROM audit_logs a
		JOIN devices d ON a.device_id = d.id
		ORDER BY a.timestamp DESC
		LIMIT $1
	`

	rows, err := db.Query(query, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query audit logs: %w", err)
	}
	defer rows.Close()

	var logs []AuditLogEntry
	for rows.Next() {
		var log AuditLogEntry
		if err := rows.Scan(&log.ID, &log.Hostname, &log.Action, &log.Success, &log.Details, &log.Timestamp); err != nil {
			return nil, fmt.Errorf("failed to scan audit log row: %w", err)
		}
		logs = append(logs, log)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("row iteration error: %w", err)
	}

	return logs, nil
}

func (db *DB) Close() error {
	db.log.Info("Closing database connection")
	return db.DB.Close()
}
