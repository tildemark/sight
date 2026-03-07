use rusqlite::{Connection, Result};
use chrono::Utc;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use tauri::Manager;

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
