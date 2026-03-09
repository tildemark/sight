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
        let candidates = [
            r"C:\Program Files\RustDesk\rustdesk.exe",
            r"C:\Program Files (x86)\RustDesk\rustdesk.exe",
        ];
        for path in &candidates {
            if Path::new(path).exists() {
                return Some(path.to_string());
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
    let id = raw.trim().to_string();

    // A valid RustDesk ID is a non-empty numeric string
    if id.is_empty() || !id.chars().all(|c| c.is_ascii_digit()) {
        println!("[RustDesk] Unexpected `--get-id` output: {:?}", id);
        return None;
    }

    println!("[RustDesk] Discovered peer ID: {}", id);
    Some(id)
}
