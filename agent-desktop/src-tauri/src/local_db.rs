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

    conn.execute(
        "CREATE TABLE IF NOT EXISTS config (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
        (),
    )?;

    // Insert Default Configurations if they don't exist
    conn.execute(
        "INSERT OR IGNORE INTO config (key, value) VALUES (?1, ?2)",
        ("server_url", "wss://api.sight.local/ws"),
    )?;
    conn.execute(
        "INSERT OR IGNORE INTO config (key, value) VALUES (?1, ?2)",
        ("fallback_config_url", "https://raw.githubusercontent.com/company/sight-config/main/config.json"),
    )?;

    Ok(())
}

pub fn insert_log(app_handle: &tauri::AppHandle, action: &str, status: &str, output: &str) -> Result<()> {
    let db_path = get_db_path(app_handle);
    let conn = Connection::open(&db_path)?;

    let timestamp = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO audit_logs (timestamp, action, status, output) VALUES (?1, ?2, ?3, ?4)",
        (&timestamp, action, status, output),
    )?;

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
