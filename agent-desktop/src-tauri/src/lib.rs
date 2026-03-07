pub mod telemetry;
pub mod ws_client;
pub mod local_db;
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
}

#[tauri::command]
fn get_local_telemetry(state: tauri::State<AppState>) -> telemetry::TelemetryData {
    let mut sys = state.sys.lock().unwrap();
    let mut dummy_dhcp: Option<bool> = None;
    telemetry::get_telemetry(&mut sys, &mut dummy_dhcp)
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
            app.manage(AppState {
                sys: Mutex::new(sys),
            });

            // Spawn the background WebSocket loop
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                ws_client::start_background_loop(app_handle).await;
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
        .invoke_handler(tauri::generate_handler![get_local_telemetry, local_db::get_local_logs])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
