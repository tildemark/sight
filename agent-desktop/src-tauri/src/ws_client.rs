use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use sysinfo::System;
use tokio::time::{sleep, Duration};
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};

use crate::telemetry::get_telemetry;
use crate::local_db;

#[derive(Serialize, Deserialize, Debug)]
pub struct WebSocketMessage {
    #[serde(rename = "type")]
    pub msg_type: String,
    pub target_hostname: Option<String>,
    pub action: Option<String>,
    pub payload: Option<serde_json::Value>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct CommandResultPayload {
    pub success: bool,
    pub output: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SyncLogsMessage {
    #[serde(rename = "type")]
    pub msg_type: String,
    pub target_hostname: String,
    pub logs: Vec<local_db::AuditLogEntry>,
}

use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};

pub async fn start_background_loop(app_handle: AppHandle) {
    let mut fail_count = 0;

    loop {
        let config = crate::local_db::get_config(app_handle.clone()).unwrap_or_default();
        
        // Compile-time defaults set by build environment (e.g. demo/prod build scripts)
        let compiled_server_url = option_env!("SIGHT_SERVER_URL").unwrap_or("ws://localhost:8080/ws");
        let compiled_fallback_url = option_env!("SIGHT_FALLBACK_URL").unwrap_or("https://sight.sanchez.ph/config.json");
        
        // Diagnostic logging: show where we're trying to connect
        println!("[WS-DEBUG] Compiled SIGHT_SERVER_URL: {}", compiled_server_url);
        println!("[WS-DEBUG] Compiled SIGHT_FALLBACK_URL: {}", compiled_fallback_url);
        
        // Server URL priority: config DB > compiled default
        let url = config.get("server_url").cloned()
            .unwrap_or_else(|| compiled_server_url.to_string());
        
        // Fallback URL priority: config DB > compiled default
        let fallback_url = config.get("fallback_config_url").cloned()
            .unwrap_or_else(|| compiled_fallback_url.to_string());
        
        println!("[WS-DEBUG] Attempting to connect to: {}", url);
        println!("[WS-DEBUG] Fallback config URL: {}", fallback_url);

        match connect_async(&url).await {
            Ok((mut ws_stream, _)) => {
                println!("Connected to {}", url);
                *app_handle.state::<crate::AppState>().is_server_connected.lock().unwrap() = true;
                fail_count = 0;

                // --- Offline sync: send any unsynced logs accumulated while disconnected ---
                let sync_hostname = sysinfo::System::host_name().unwrap_or_else(|| "Unknown".to_string());
                match local_db::get_unsynced_logs(&app_handle) {
                    Ok(unsynced) if !unsynced.is_empty() => {
                        let ids: Vec<i64> = unsynced.iter().map(|e| e.id).collect();
                        let sync_msg = SyncLogsMessage {
                            msg_type: "SYNC_LOGS".to_string(),
                            target_hostname: sync_hostname.clone(),
                            logs: unsynced,
                        };
                        if let Ok(json) = serde_json::to_string(&sync_msg) {
                            match ws_stream.send(tokio_tungstenite::tungstenite::protocol::Message::Text(json.into())).await {
                                Ok(_) => {
                                    println!("Sent SYNC_LOGS for {} offline log(s)", ids.len());
                                    if let Err(e) = local_db::mark_logs_synced(&app_handle, ids) {
                                        println!("Warning: failed to mark offline logs as synced: {}", e);
                                    }
                                }
                                Err(e) => {
                                    println!("Warning: failed to send SYNC_LOGS: {}", e);
                                }
                            }
                        }
                    }
                    Ok(_) => {} // no unsynced logs
                    Err(e) => {
                        println!("Warning: failed to query unsynced logs: {}", e);
                    }
                }
                // --- End offline sync ---

                let mut sys = System::new_all();

                // Refresh once initially to baseline CPU usage.
                sys.refresh_cpu_usage();
                sleep(Duration::from_millis(200)).await;

                let (mut write, mut read) = ws_stream.split();
                
                let sys_hostname = sysinfo::System::host_name().unwrap_or_else(|| "Unknown".to_string());
                
                // Channel for the read task to queue outgoing messages (like command results)
                let (tx, mut rx) = tokio::sync::mpsc::channel::<Message>(32);

                // Spawn listener task for incoming commands from Dashboard
                let read_task = tauri::async_runtime::spawn({
                    let sys_hostname = sys_hostname.clone();
                    let tx = tx.clone();
                    let app_handle = app_handle.clone();
                    async move {
                        while let Some(message) = read.next().await {
                            match message {
                                Ok(Message::Text(text)) => {
                                    if let Ok(msg) = serde_json::from_str::<WebSocketMessage>(&text) {
                                        if msg.msg_type == "COMMAND" {
                                            if let Some(target) = &msg.target_hostname {
                                                if target == &sys_hostname {
                                                    if let Some(action) = &msg.action {
                                                        println!("Received Remote Command Request: {}", action);
                                                        
                                                        let friendly_action = match action.as_str() {
                                                            "shutdown /r /t 0" => "Restart your computer".to_string(),
                                                            "net stop spooler && net start spooler" => "Restart the Print Spooler service".to_string(),
                                                            "RESTART_AGENT" => "Restart the background support agent".to_string(),
                                                            "UPDATE_AGENT" => "Auto-update is disabled for this build".to_string(),
                                                            _ => action.clone(),
                                                        };
                                                        
                                                        // Check for blanket consent (24-hour grant)
                                                        let consent_expires_at = {
                                                            let state = app_handle.state::<crate::AppState>();
                                                            let consent = *state.consent_granted_until.lock().unwrap();
                                                            consent
                                                        };
                                                        let consent_was_already_active = consent_expires_at.map(|instant| instant > std::time::Instant::now()).unwrap_or(false);
                                                        
                                                        let mut consent_given = false;
                                                        let dialog_was_shown = !consent_was_already_active;
                                                        
                                                        if consent_was_already_active {
                                                            // Blanket consent active — skip dialog
                                                            println!("Blanket consent active — skipping dialog for: {}", action);
                                                            consent_given = true;
                                                        } else {
                                                            // Show consent dialog
                                                            let prompt_msg = format!("IT Administrator is requesting to: {}\n\nDo you accept?", friendly_action);
                                                            
                                                            // Bring the main window to front before showing dialog
                                                            if let Some(window) = app_handle.get_webview_window("main") {
                                                                let _ = window.show();
                                                                let _ = window.set_focus();
                                                                let _ = window.set_always_on_top(true);
                                                            }
                                                            
                                                            let (tx_consent, rx_consent) = tokio::sync::oneshot::channel();
                                                            
                                                            app_handle.dialog()
                                                                .message(prompt_msg)
                                                                .kind(MessageDialogKind::Warning)
                                                                .title("Security Action Required")
                                                                .buttons(MessageDialogButtons::OkCancelCustom("Accept".to_string(), "Deny".to_string()))
                                                                .show(move |result| {
                                                                    let _ = tx_consent.send(result);
                                                                });
                                                            
                                                            consent_given = match rx_consent.await {
                                                                Ok(accepted) => accepted,
                                                                Err(_) => false,
                                                            };
                                                            
                                                            // If user accepted and dialog was shown, grant blanket consent
                                                            if consent_given {
                                                                let state = app_handle.state::<crate::AppState>();
                                                                *state.consent_granted_until.lock().unwrap() = Some(std::time::Instant::now() + std::time::Duration::from_secs(86400));
                                                                
                                                                // Show notification about blanket consent grant
                                                                app_handle.dialog()
                                                                    .message("IT Support Access Granted — Remote commands will be executed without prompting for 24 hours. Restart the agent to revoke.")
                                                                    .title("Access Granted")
                                                                    .kind(MessageDialogKind::Info)
                                                                    .show(|_| {});
                                                            }
                                                        }

                                                        if !consent_given {
                                                            println!("User denied command execution: {}", action);
                                                            let denied_log_id = local_db::insert_log_returning_id(&app_handle, action, "Denied", "User denied the remote execution request.").ok();
                                                            let reply = WebSocketMessage {
                                                                msg_type: "COMMAND_RESULT".to_string(),
                                                                target_hostname: Some(sys_hostname.clone()),
                                                                action: Some(action.to_string()),
                                                                payload: Some(serde_json::to_value(CommandResultPayload {
                                                                    success: false,
                                                                    output: "Error: User denied the remote execution request.".to_string(),
                                                                }).unwrap()),
                                                            };
                                                            if let Ok(json) = serde_json::to_string(&reply) {
                                                                if tx.send(Message::Text(json.into())).await.is_ok() {
                                                                    if let Some(log_id) = denied_log_id {
                                                                        let _ = local_db::mark_logs_synced(&app_handle, vec![log_id]);
                                                                    }
                                                                }
                                                            }
                                                            continue;
                                                        }

                                                        println!("User accepted. Executing Remote Command: {}", action);
                                                        
                                                        if action == "UPDATE_AGENT" {
                                                            let disabled_msg = "Auto-update is disabled in this build. Please deploy a new installer package manually.";
                                                            let update_log_id = local_db::insert_log_returning_id(&app_handle, action, "Rejected", disabled_msg).ok();
                                                            let reply = WebSocketMessage {
                                                                msg_type: "COMMAND_RESULT".to_string(),
                                                                target_hostname: Some(sys_hostname.clone()),
                                                                action: Some(action.to_string()),
                                                                payload: Some(serde_json::to_value(CommandResultPayload {
                                                                    success: false,
                                                                    output: disabled_msg.to_string(),
                                                                }).unwrap()),
                                                            };
                                                            if let Ok(json) = serde_json::to_string(&reply) {
                                                                if tx.send(Message::Text(json.into())).await.is_ok() {
                                                                    if let Some(log_id) = update_log_id {
                                                                        let _ = local_db::mark_logs_synced(&app_handle, vec![log_id]);
                                                                    }
                                                                }
                                                            }

                                                        } else if action == "RESTART_AGENT" {
                                                            // RESTART_AGENT doesn't send a COMMAND_RESULT reply, so mark synced immediately
                                                            if let Ok(log_id) = local_db::insert_log_returning_id(&app_handle, action, "Accepted", "Agent restart sequence initiated.") {
                                                                let _ = local_db::mark_logs_synced(&app_handle, vec![log_id]);
                                                            }
                                                            if let Ok(exe_path) = std::env::current_exe() {
                                                                let pid = std::process::id();
                                                                let ps_script = format!(
                                                                    "Start-Sleep -Seconds 2; Stop-Process -Id {} -Force; Start-Process -FilePath '{}'",
                                                                    pid,
                                                                    exe_path.display()
                                                                );
                                                                
                                                                let mut cmd = if cfg!(target_os = "windows") {
                                                                    #[cfg(target_os = "windows")]
                                                                    use std::os::windows::process::CommandExt;
                                                                    let mut c = std::process::Command::new("powershell");
                                                                    #[cfg(target_os = "windows")]
                                                                    c.creation_flags(0x08000000);
                                                                    c.arg("-WindowStyle").arg("Hidden").arg("-Command").arg(ps_script);
                                                                    c
                                                                } else {
                                                                    let mut c = std::process::Command::new("sh");
                                                                    c.arg("-c").arg(format!("sleep 2 && kill -9 {} && '{}' &", pid, exe_path.display()));
                                                                    c
                                                                };
                                                                
                                                                let _ = cmd.spawn();
                                                            }
                                                        } else {
                                                            let mut cmd = if cfg!(target_os = "windows") {
                                                                #[cfg(target_os = "windows")]
                                                                use std::os::windows::process::CommandExt;
                                                                let mut c = std::process::Command::new("cmd");
                                                                #[cfg(target_os = "windows")]
                                                                c.creation_flags(0x08000000);
                                                                c
                                                            } else {
                                                                std::process::Command::new("sh")
                                                            };
                                                            
                                                            if cfg!(target_os = "windows") {
                                                                cmd.arg("/C").arg(action);
                                                            } else {
                                                                cmd.arg("-c").arg(action);
                                                            }

                                                            let (result_payload, cmd_log_id) = match cmd.output() {
                                                                Ok(output) => {
                                                                    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                                                                    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                                                                    let combined = format!("{}{}", stdout, stderr);
                                                                    let final_output = if combined.is_empty() { "Command executed without output.".to_string() } else { combined };
                                                                    
                                                                    let log_id = local_db::insert_log_returning_id(&app_handle, action, if output.status.success() { "Success" } else { "Failed" }, &final_output).ok();

                                                                    (CommandResultPayload {
                                                                        success: output.status.success(),
                                                                        output: final_output
                                                                    }, log_id)
                                                                },
                                                                Err(e) => {
                                                                    let err_msg = format!("Failed to spawn command: {}", e);
                                                                    let log_id = local_db::insert_log_returning_id(&app_handle, action, "Failed", &err_msg).ok();

                                                                    (CommandResultPayload {
                                                                        success: false,
                                                                        output: err_msg
                                                                    }, log_id)
                                                                }
                                                            };
                                                            
                                                            let reply = WebSocketMessage {
                                                                msg_type: "COMMAND_RESULT".to_string(),
                                                                target_hostname: Some(sys_hostname.clone()),
                                                                action: Some(action.to_string()),
                                                                payload: Some(serde_json::to_value(result_payload).unwrap()),
                                                            };
                                                            
                                                            if let Ok(json) = serde_json::to_string(&reply) {
                                                                if tx.send(Message::Text(json.into())).await.is_ok() {
                                                                    if let Some(log_id) = cmd_log_id {
                                                                        let _ = local_db::mark_logs_synced(&app_handle, vec![log_id]);
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        } else if msg.msg_type == "RUSTDESK_REQUEST" {
                                            // Only handle if this message targets this hostname
                                            if let Some(target) = &msg.target_hostname {
                                                if target == &sys_hostname {
                                                    // Extract rustdesk_id from payload
                                                    let rustdesk_id = msg.payload
                                                        .as_ref()
                                                        .and_then(|p| p.get("rustdesk_id"))
                                                        .and_then(|v| v.as_str())
                                                        .unwrap_or("Unknown")
                                                        .to_string();
                                                    
                                                    // Show consent dialog — ALWAYS ask, never use blanket consent for RustDesk
                                                    let prompt_msg = format!(
                                                        "IT Administrator is requesting to start a Remote Desktop session on this computer.\n\nRustDesk Peer ID: {}\n\nDo you accept?",
                                                        rustdesk_id
                                                    );
                                                    
                                                    // Bring the main window to front before showing dialog
                                                    if let Some(window) = app_handle.get_webview_window("main") {
                                                        let _ = window.show();
                                                        let _ = window.set_focus();
                                                        let _ = window.set_always_on_top(true);
                                                    }
                                                    
                                                    let (tx_consent, rx_consent) = tokio::sync::oneshot::channel();
                                                    app_handle.dialog()
                                                        .message(prompt_msg)
                                                        .kind(MessageDialogKind::Warning)
                                                        .title("Remote Desktop Access Requested")
                                                        .buttons(MessageDialogButtons::OkCancelCustom("Accept".to_string(), "Deny".to_string()))
                                                        .show(move |result| { let _ = tx_consent.send(result); });
                                                    
                                                    let consent_given = rx_consent.await.unwrap_or(false);
                                                    let status = if consent_given { "Accepted" } else { "Denied" };
                                                    let output = if consent_given {
                                                        format!("User accepted RustDesk remote desktop session. Peer ID: {}", rustdesk_id)
                                                    } else {
                                                        "User denied RustDesk remote desktop session request.".to_string()
                                                    };
                                                    
                                                    // Log locally
                                                    let _ = local_db::insert_log_returning_id(&app_handle, "RUSTDESK_CONNECT", status, &output);
                                                    
                                                    // Send RUSTDESK_CONSENT back to server
                                                    let consent_reply = WebSocketMessage {
                                                        msg_type: "RUSTDESK_CONSENT".to_string(),
                                                        target_hostname: Some(sys_hostname.clone()),
                                                        action: Some("RUSTDESK_CONNECT".to_string()),
                                                        payload: Some(serde_json::json!({
                                                            "accepted": consent_given,
                                                            "rustdesk_id": rustdesk_id,
                                                            "output": output
                                                        })),
                                                    };
                                                    if let Ok(json) = serde_json::to_string(&consent_reply) {
                                                        let _ = tx.send(Message::Text(json.into())).await;
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                                Ok(Message::Close(_)) => break,
                                _ => {}
                            }
                        }
                    }
                });

                // Main writer loop for Telemetry and Queued Messages
                loop {
                    tokio::select! {
                        Some(queued_msg) = rx.recv() => {
                            if let Err(e) = write.send(queued_msg).await {
                                println!("Failed to send queued message: {}", e);
                                break;
                            }
                        }
                        _ = sleep(Duration::from_secs(5)) => {
                            let mut dhcp_val = {
                                let state = app_handle.state::<crate::AppState>();
                                let val = state.dhcp_enabled.lock().unwrap().clone();
                                val
                            };
                            // Read the cached RustDesk ID from AppState (refreshed hourly by lib.rs)
                            let rustdesk_id = {
                                let state = app_handle.state::<crate::AppState>();
                                let val = state.rustdesk_id.lock().unwrap().clone();
                                val
                            };
                            let telemetry = get_telemetry(&mut sys, &mut dhcp_val, rustdesk_id);
                            
                            // Save it back to the state if it was updated
                            if let Some(new_val) = dhcp_val {
                                let state = app_handle.state::<crate::AppState>();
                                *state.dhcp_enabled.lock().unwrap() = Some(new_val);
                            }

                            let wrapper = WebSocketMessage {
                                msg_type: "TELEMETRY".to_string(),
                                target_hostname: None,
                                action: None,
                                payload: Some(serde_json::to_value(telemetry).unwrap()),
                            };

                            if let Ok(json) = serde_json::to_string(&wrapper) {
                                if let Err(e) = write.send(Message::Text(json.into())).await {
                                    println!("Failed to send telemetry: {}", e);
                                    break;
                                }
                            }
                        }
                    }
                }
                
                read_task.abort(); // cleanup listener on disconnect
                *app_handle.state::<crate::AppState>().is_server_connected.lock().unwrap() = false;
            }
            Err(e) => {
                println!("[WS-DEBUG] Connection FAILED: {}", e);
                println!("[WS-DEBUG] This usually means:");
                println!("[WS-DEBUG]   1. The server URL is wrong or unreachable");
                println!("[WS-DEBUG]   2. The server is not running");
                println!("[WS-DEBUG]   3. There's a network/firewall issue");
                println!("[WS-DEBUG]   4. Using HTTPS (wss://) but server only supports HTTP (ws://)");
                *app_handle.state::<crate::AppState>().is_server_connected.lock().unwrap() = false;
                
                fail_count += 1;
                if fail_count >= 5 {
                    println!("Connection failed 5 times. Attempting to fetch fallback config from {}", fallback_url);
                    if let Ok(resp) = reqwest::get(&fallback_url).await {
                        if let Ok(json) = resp.json::<serde_json::Value>().await {
                            if let Some(new_url) = json.get("server_url").and_then(|v| v.as_str()) {
                                if new_url != url {
                                    println!("Discovered new server URL from fallback config: {}", new_url);
                                    let _ = crate::local_db::set_config(app_handle.clone(), "server_url".to_string(), new_url.to_string());
                                }
                            }
                        }
                    }
                    fail_count = 0; // Reset to try old/new URL 5 more times before checking config again
                }

                sleep(Duration::from_secs(5)).await;
            }
        }
    }
}
