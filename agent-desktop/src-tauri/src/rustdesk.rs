use std::process::Command;
use std::path::Path;

/// Attempts to resolve the RustDesk executable path.
/// First checks if `rustdesk` is available in the system PATH,
/// then falls back to common Windows and Linux/macOS install locations.
fn find_rustdesk_exe() -> Option<String> {
    // 1. Try PATH first (works if RustDesk installer added it to PATH)
    if which_rustdesk("rustdesk") {
        return Some("rustdesk".to_string());
    }

    // 2. Windows: check common install directories
    #[cfg(target_os = "windows")]
    {
        // First try standard install locations
        let standard_candidates = [
            r"C:\Program Files\RustDesk\rustdesk.exe",
            r"C:\Program Files (x86)\RustDesk\rustdesk.exe",
        ];
        for path in &standard_candidates {
            if Path::new(path).exists() {
                return Some(path.to_string());
            }
        }
        
        // Fallback: scan Downloads folder for any rustdesk*.exe (version changes on update)
        if let Ok(home) = std::env::var("USERPROFILE") {
            let downloads = format!(r"{}\Downloads", home);
            if let Ok(entries) = std::fs::read_dir(&downloads) {
                for entry in entries.flatten() {
                    if let Some(name) = entry.file_name().to_str() {
                        if name.to_lowercase().starts_with("rustdesk") && name.to_lowercase().ends_with(".exe") {
                            let full_path = entry.path();
                            if full_path.is_file() {
                                return Some(full_path.to_string_lossy().to_string());
                            }
                        }
                    }
                }
            }
        }
    }

    // 3. macOS: check Applications bundle
    #[cfg(target_os = "macos")]
    {
        let candidates = [
            "/Applications/RustDesk.app/Contents/MacOS/rustdesk",
        ];
        for path in &candidates {
            if Path::new(path).exists() {
                return Some(path.to_string());
            }
        }
    }

    // 4. Linux: check common install paths
    #[cfg(target_os = "linux")]
    {
        let candidates = [
            "/usr/bin/rustdesk",
            "/usr/local/bin/rustdesk",
            "/opt/rustdesk/rustdesk",
        ];
        for path in &candidates {
            if Path::new(path).exists() {
                return Some(path.to_string());
            }
        }
    }

    None
}

/// Probes whether a given executable name resolves via PATH by attempting
/// to run it with `--version`. Returns true if the process spawns successfully.
fn which_rustdesk(exe: &str) -> bool {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        Command::new(exe)
            .arg("--version")
            .creation_flags(0x08000000) // CREATE_NO_WINDOW
            .output()
            .is_ok()
    }
    #[cfg(not(target_os = "windows"))]
    {
        Command::new(exe)
            .arg("--version")
            .output()
            .is_ok()
    }
}

/// Fetches the RustDesk peer ID for this machine by invoking the RustDesk
/// CLI with the `--get-id` flag. Returns `None` if RustDesk is not installed,
/// the command fails, or the output cannot be parsed as a valid ID.
///
/// The ID is a numeric string (e.g., "123456789"). RustDesk prints it to
/// stdout followed by a newline.
pub fn get_rustdesk_id() -> Option<String> {
    let exe = find_rustdesk_exe()?;

    let output = {
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            Command::new(&exe)
                .arg("--get-id")
                .creation_flags(0x08000000) // CREATE_NO_WINDOW — prevents a console flash
                .output()
                .ok()?
        }
        #[cfg(not(target_os = "windows"))]
        {
            Command::new(&exe)
                .arg("--get-id")
                .output()
                .ok()?
        }
    };

    if !output.status.success() {
        println!("[RustDesk] `--get-id` exited with non-zero status: {}", output.status);
        return None;
    }

    let raw = String::from_utf8_lossy(&output.stdout);
    // RustDesk outputs debug info to stdout before the ID.
    // Extract the last non-empty line which should be the numeric ID.
    let id = raw
        .lines()
        .filter(|line| !line.trim().is_empty())
        .last()
        .map(|line| line.trim().to_string())
        .unwrap_or_default();

    // A valid RustDesk ID is a non-empty numeric string
    if id.is_empty() || !id.chars().all(|c| c.is_ascii_digit()) {
        println!("[RustDesk] Unexpected `--get-id` output: {:?}", raw);
        return None;
    }

    println!("[RustDesk] Discovered peer ID: {}", id);
    Some(id)
}

/// Sets the RustDesk password for unattended access.
/// Uses the `--set-password` flag which is available in RustDesk.
/// Returns Ok(true) on success, Ok(false) if RustDesk is not installed,
/// or Err with the error message if the command fails.
pub fn set_unattended_password(password: &str) -> Result<bool, String> {
    let exe = match find_rustdesk_exe() {
        Some(path) => path,
        None => {
            println!("[RustDesk] Cannot set password: RustDesk not found");
            return Ok(false);
        }
    };

    let output = {
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            Command::new(&exe)
                .arg("--set-password")
                .arg(password)
                .creation_flags(0x08000000) // CREATE_NO_WINDOW
                .output()
                .map_err(|e| format!("Failed to execute RustDesk: {}", e))?
        }
        #[cfg(not(target_os = "windows"))]
        {
            Command::new(&exe)
                .arg("--set-password")
                .arg(password)
                .output()
                .map_err(|e| format!("Failed to execute RustDesk: {}", e))?
        }
    };

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        println!("[RustDesk] --set-password failed: {}", stderr);
        return Err(format!("Failed to set password: {}", stderr.trim()));
    }

    println!("[RustDesk] Password set successfully");
    Ok(true)
}
