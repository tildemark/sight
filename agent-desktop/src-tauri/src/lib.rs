pub mod telemetry;
pub mod ws_client;
pub mod local_db;
pub mod rustdesk;

use std::sync::Mutex;
use sysinfo::System;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};
use tauri_plugin_autostart::ManagerExt;

pub struct AppState {
    pub sys: Mutex<System>,
    pub dhcp_enabled: Mutex<Option<bool>>,
    pub is_server_connected: Mutex<bool>,
    /// Cached RustDesk peer ID. Populated at startup and refreshed hourly
    /// so that agents that install RustDesk after the agent starts will
    /// eventually report their ID without requiring a restart.
    pub rustdesk_id: Mutex<Option<String>>,
}

#[tauri::command]
fn get_connection_status(state: tauri::State<AppState>) -> bool {
    *state.is_server_connected.lock().unwrap()
}

#[tauri::command]
fn get_local_telemetry(state: tauri::State<AppState>) -> telemetry::TelemetryData {
    let mut sys = state.sys.lock().unwrap();
    let mut dhcp_enabled = state.dhcp_enabled.lock().unwrap();
    let rustdesk_id = state.rustdesk_id.lock().unwrap().clone();
    telemetry::get_telemetry(&mut sys, &mut dhcp_enabled, rustdesk_id)
}

/// Returns the cached RustDesk peer ID for this machine.
/// Returns `None` if RustDesk is not installed or the ID has not yet been resolved.
#[tauri::command]
fn get_rustdesk_id(state: tauri::State<AppState>) -> Option<String> {
    state.rustdesk_id.lock().unwrap().clone()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, Some(vec![])))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            // Enable autostart
            let _ = app.autolaunch().enable();

            // Initialize Local SQLite Database
            if let Err(e) = local_db::init_db(&app.handle()) {
                eprintln!("Failed to initialize local audit database: {}", e);
            }

            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(0);
                    }
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            let mut sys = System::new_all();
            sys.refresh_cpu_usage();

            // Perform the initial RustDesk ID lookup synchronously at startup.
            // This is a fast CLI call and acceptable on the setup thread.
            let initial_rustdesk_id = rustdesk::get_rustdesk_id();
            if let Some(ref id) = initial_rustdesk_id {
                println!("[RustDesk] Initial peer ID: {}", id);
            } else {
                println!("[RustDesk] Not detected at startup. Will retry hourly.");
            }

            app.manage(AppState {
                sys: Mutex::new(sys),
                dhcp_enabled: Mutex::new(None),
                is_server_connected: Mutex::new(false),
                rustdesk_id: Mutex::new(initial_rustdesk_id),
            });

            // Spawn the background WebSocket loop
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                ws_client::start_background_loop(app_handle).await;
            });

            // Spawn the hourly RustDesk ID refresh task.
            // This ensures that if RustDesk is installed after the agent starts,
            // the ID will be picked up within the next hour without a restart.
            let app_handle_rd = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                loop {
                    // Wait one hour before the first refresh (initial fetch already done above)
                    tokio::time::sleep(tokio::time::Duration::from_secs(3600)).await;

                    let new_id = rustdesk::get_rustdesk_id();
                    let state = app_handle_rd.state::<AppState>();
                    let mut cached = state.rustdesk_id.lock().unwrap();

                    match (&*cached, &new_id) {
                        (None, Some(id)) => {
                            println!("[RustDesk] Hourly refresh: discovered new peer ID: {}", id);
                            *cached = new_id;
                        }
                        (Some(old), Some(new)) if old != new => {
                            println!("[RustDesk] Hourly refresh: peer ID changed from {} to {}", old, new);
                            *cached = new_id;
                        }
                        _ => {
                            // No change — nothing to do
                        }
                    }
                }
            });

            Ok(())
        })
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                let _ = window.hide();
                api.prevent_close();
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            get_local_telemetry,
            local_db::get_local_logs,
            get_connection_status,
            get_rustdesk_id,
            local_db::get_config,
            local_db::set_config
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
