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

use tauri::AppHandle;
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
use tauri_plugin_updater::UpdaterExt;

pub async fn start_background_loop(app_handle: AppHandle) {
    let url = "ws://localhost:8080/ws";

    loop {
        match connect_async(url).await {
            Ok((mut ws_stream, _)) => {
                println!("Connected to {}", url);
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
                                                            "UPDATE_AGENT" => "Download and install the latest S.I.G.H.T Agent update".to_string(),
                                                            _ => action.clone(),
                                                        };
                                                        
                                                        // Request User Consent
                                                        let prompt_msg = format!("IT Administrator is requesting to: {}\n\nDo you accept?", friendly_action);
                                                        let (tx_consent, rx_consent) = tokio::sync::oneshot::channel();
                                                        
                                                        app_handle.dialog()
                                                            .message(prompt_msg)
                                                            .kind(MessageDialogKind::Warning)
                                                            .title("Security Action Required")
                                                            .buttons(MessageDialogButtons::OkCancelCustom("Accept".to_string(), "Deny".to_string()))
                                                            .show(move |result| {
                                                                let _ = tx_consent.send(result);
                                                            });
                                                            
                                                        let consent_given = match rx_consent.await {
                                                            Ok(accepted) => accepted,
                                                            Err(_) => false,
                                                        };

                                                        if !consent_given {
                                                            println!("User denied command execution: {}", action);
                                                            let _ = local_db::insert_log(&app_handle, action, "Denied", "User denied the remote execution request.");
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
                                                                let _ = tx.send(Message::Text(json.into())).await;
                                                            }
                                                            continue;
                                                        }

                                                        println!("User accepted. Executing Remote Command: {}", action);
                                                        
                                                        if action == "UPDATE_AGENT" {
                                                            let _ = local_db::insert_log(&app_handle, action, "Accepted", "Update initiated. The agent will disconnect briefly while installing...");
                                                            let reply = WebSocketMessage {
                                                                msg_type: "COMMAND_RESULT".to_string(),
                                                                target_hostname: Some(sys_hostname.clone()),
                                                                action: Some(action.to_string()),
                                                                payload: Some(serde_json::to_value(CommandResultPayload {
                                                                    success: true,
                                                                    output: "Update initiated. The agent will disconnect briefly while installing...".to_string(),
                                                                }).unwrap()),
                                                            };
                                                            if let Ok(json) = serde_json::to_string(&reply) {
                                                                let _ = tx.send(Message::Text(json.into())).await;
                                                            }

                                                            let app_handle_clone = app_handle.clone();
                                                            tauri::async_runtime::spawn(async move {
                                                                if let Ok(updater) = app_handle_clone.updater() {
                                                                    if let Ok(Some(update)) = updater.check().await {
                                                                        println!("Update found: {}. Downloading...", update.version);
                                                                        if let Err(e) = update.download_and_install(|_, _| {}, || {}).await {
                                                                            println!("Failed to download and install update: {}", e);
                                                                        } else {
                                                                            println!("Update installed successfully. Restarting...");
                                                                            app_handle_clone.restart();
                                                                        }
                                                                    } else {
                                                                        println!("No update available or error checking.");
                                                                    }
                                                                }
                                                            });

                                                        } else if action == "RESTART_AGENT" {
                                                            let _ = local_db::insert_log(&app_handle, action, "Accepted", "Agent restart sequence initiated.");
                                                            if let Ok(exe_path) = std::env::current_exe() {
                                                                let pid = std::process::id();
                                                                let ps_script = format!(
                                                                    "Start-Sleep -Seconds 2; Stop-Process -Id {} -Force; Start-Process -FilePath '{}'",
                                                                    pid,
                                                                    exe_path.display()
                                                                );
                                                                
                                                                let mut cmd = if cfg!(target_os = "windows") {
                                                                    let mut c = std::process::Command::new("powershell");
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
                                                                std::process::Command::new("cmd")
                                                            } else {
                                                                std::process::Command::new("sh")
                                                            };
                                                            
                                                            if cfg!(target_os = "windows") {
                                                                cmd.arg("/C").arg(action);
                                                            } else {
                                                                cmd.arg("-c").arg(action);
                                                            }

                                                            let result_payload = match cmd.output() {
                                                                Ok(output) => {
                                                                    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                                                                    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                                                                    let combined = format!("{}{}", stdout, stderr);
                                                                    let final_output = if combined.is_empty() { "Command executed without output.".to_string() } else { combined };
                                                                    
                                                                    let _ = local_db::insert_log(&app_handle, action, if output.status.success() { "Success" } else { "Failed" }, &final_output);

                                                                    CommandResultPayload {
                                                                        success: output.status.success(),
                                                                        output: final_output
                                                                    }
                                                                },
                                                                Err(e) => {
                                                                    let err_msg = format!("Failed to spawn command: {}", e);
                                                                    let _ = local_db::insert_log(&app_handle, action, "Failed", &err_msg);

                                                                    CommandResultPayload {
                                                                        success: false,
                                                                        output: err_msg
                                                                    }
                                                                }
                                                            };
                                                            
                                                            let reply = WebSocketMessage {
                                                                msg_type: "COMMAND_RESULT".to_string(),
                                                                target_hostname: Some(sys_hostname.clone()),
                                                                action: Some(action.to_string()),
                                                                payload: Some(serde_json::to_value(result_payload).unwrap()),
                                                            };
                                                            
                                                            if let Ok(json) = serde_json::to_string(&reply) {
                                                                let _ = tx.send(Message::Text(json.into())).await;
                                                            }
                                                        }
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

                let mut dhcp_cache: Option<bool> = None;

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
                            let telemetry = get_telemetry(&mut sys, &mut dhcp_cache);
                            
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
            }
            Err(e) => {
                println!("Failed to connect: {}. Retrying in 5 seconds...", e);
                sleep(Duration::from_secs(5)).await;
            }
        }
    }
}
