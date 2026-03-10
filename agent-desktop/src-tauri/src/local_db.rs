use rusqlite::{Connection, Result};
use chrono::Utc;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use tauri::Manager;
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize)]
pub struct LocalLog {
    pub id: i64,
    pub timestamp: String,
    pub action: String,
    pub status: String,
    pub output: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AuditLogEntry {
    pub id: i64,
    pub timestamp: String,
    pub action: String,
    pub status: String,
    pub output: String,
}

pub fn get_db_path(app_handle: &tauri::AppHandle) -> PathBuf {
    let mut path = app_handle.path().app_data_dir().expect("Failed to get AppData directory");
    std::fs::create_dir_all(&path).expect("Failed to create AppData directory");
    path.push("sight_agent.db");
    path
}

pub fn init_db(app_handle: &tauri::AppHandle) -> Result<()> {
    let db_path = get_db_path(app_handle);
    let conn = Connection::open(&db_path)?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            action TEXT NOT NULL,
            status TEXT NOT NULL,
            output TEXT NOT NULL
        )",
        (), // empty list of parameters
    )?;

    // Migrate existing databases: add synced column if it doesn't exist yet.
    // rusqlite returns SqliteFailure with extended_code 1 for "duplicate column name".
    match conn.execute(
        "ALTER TABLE audit_logs ADD COLUMN synced INTEGER NOT NULL DEFAULT 0",
        (),
    ) {
        Ok(_) => {}
        Err(rusqlite::Error::SqliteFailure(err, _)) if err.extended_code == 1 => {
            // Column already exists — safe to ignore
        }
        Err(e) => return Err(e),
    }

    conn.execute(
        "CREATE TABLE IF NOT EXISTS config (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
        (),
    )?;

    // Insert Default Configurations if they don't exist
    // Use build-time environment variables as defaults (set during MSI build)
    let default_server_url = std::env::var("SIGHT_SERVER_URL")
        .unwrap_or_else(|_| "ws://localhost:8080/ws".to_string());
    let default_fallback_url = std::env::var("SIGHT_FALLBACK_URL")
        .unwrap_or_else(|_| "https://sight.sanchez.ph/config.json".to_string());
    
    conn.execute(
        "INSERT OR IGNORE INTO config (key, value) VALUES (?1, ?2)",
        ("server_url", default_server_url.as_str()),
    )?;
    conn.execute(
        "INSERT OR IGNORE INTO config (key, value) VALUES (?1, ?2)",
        ("fallback_config_url", default_fallback_url.as_str()),
    )?;

    Ok(())
}

pub fn insert_log(app_handle: &tauri::AppHandle, action: &str, status: &str, output: &str) -> Result<()> {
    let db_path = get_db_path(app_handle);
    let conn = Connection::open(&db_path)?;

    let timestamp = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO audit_logs (timestamp, action, status, output, synced) VALUES (?1, ?2, ?3, ?4, 0)",
        (&timestamp, action, status, output),
    )?;

    Ok(())
}

pub fn insert_log_returning_id(app_handle: &tauri::AppHandle, action: &str, status: &str, output: &str) -> std::result::Result<i64, String> {
    let db_path = get_db_path(app_handle);
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let timestamp = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO audit_logs (timestamp, action, status, output, synced) VALUES (?1, ?2, ?3, ?4, 0)",
        (&timestamp, action, status, output),
    ).map_err(|e| e.to_string())?;

    Ok(conn.last_insert_rowid())
}

pub fn get_unsynced_logs(app_handle: &tauri::AppHandle) -> std::result::Result<Vec<AuditLogEntry>, String> {
    let db_path = get_db_path(app_handle);
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(
        "SELECT id, timestamp, action, status, output FROM audit_logs WHERE synced = 0 ORDER BY id ASC"
    ).map_err(|e| e.to_string())?;

    let log_iter = stmt.query_map([], |row| {
        Ok(AuditLogEntry {
            id: row.get(0)?,
            timestamp: row.get(1)?,
            action: row.get(2)?,
            status: row.get(3)?,
            output: row.get(4)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut logs = Vec::new();
    for log in log_iter {
        logs.push(log.map_err(|e| e.to_string())?);
    }

    Ok(logs)
}

pub fn mark_logs_synced(app_handle: &tauri::AppHandle, ids: Vec<i64>) -> std::result::Result<(), String> {
    if ids.is_empty() {
        return Ok(());
    }

    let db_path = get_db_path(app_handle);
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    // Build a parameterised IN clause: UPDATE ... WHERE id IN (?,?,?)
    let placeholders: Vec<String> = ids.iter().enumerate().map(|(i, _)| format!("?{}", i + 1)).collect();
    let sql = format!(
        "UPDATE audit_logs SET synced = 1 WHERE id IN ({})",
        placeholders.join(", ")
    );

    let params: Vec<&dyn rusqlite::ToSql> = ids.iter().map(|id| id as &dyn rusqlite::ToSql).collect();
    conn.execute(&sql, params.as_slice()).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn get_local_logs(app_handle: tauri::AppHandle) -> std::result::Result<Vec<LocalLog>, String> {
    let db_path = get_db_path(&app_handle);
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare("SELECT id, timestamp, action, status, output FROM audit_logs ORDER BY id DESC LIMIT 100")
        .map_err(|e| e.to_string())?;
        
    let log_iter = stmt.query_map([], |row| {
        Ok(LocalLog {
            id: row.get(0)?,
            timestamp: row.get(1)?,
            action: row.get(2)?,
            status: row.get(3)?,
            output: row.get(4)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut logs = Vec::new();
    for log in log_iter {
        logs.push(log.map_err(|e| e.to_string())?);
    }

    Ok(logs)
}

#[tauri::command]
pub fn get_config(app_handle: tauri::AppHandle) -> std::result::Result<HashMap<String, String>, String> {
    let db_path = get_db_path(&app_handle);
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare("SELECT key, value FROM config").map_err(|e| e.to_string())?;
    let config_iter = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    }).map_err(|e| e.to_string())?;

    let mut map = HashMap::new();
    for item in config_iter {
        let (k, v) = item.map_err(|e| e.to_string())?;
        map.insert(k, v);
    }

    Ok(map)
}

#[tauri::command]
pub fn set_config(app_handle: tauri::AppHandle, key: String, value: String) -> std::result::Result<(), String> {
    let db_path = get_db_path(&app_handle);
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO config (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        (&key, &value),
    ).map_err(|e| e.to_string())?;

    Ok(())
}
