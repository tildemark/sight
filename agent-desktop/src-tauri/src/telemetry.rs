use serde::{Deserialize, Serialize};
use sysinfo::{System, Networks};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TelemetryData {
    pub hostname: String,
    pub os_version: String,
    pub device_type: String,
    pub agent_version: String,
    pub cpu_usage: f32,
    pub memory_used: u64,
    pub memory_total: u64,
    pub disk_used: u64,
    pub disk_total: u64,
    pub ip_address: Option<String>,
    pub mac_address: Option<String>,
    pub dhcp_enabled: Option<bool>,
}

pub fn get_telemetry(sys: &mut System, dhcp_cache: &mut Option<bool>) -> TelemetryData {
    sys.refresh_cpu_usage();
    sys.refresh_memory();

    let disks = sysinfo::Disks::new_with_refreshed_list();
    let mut disk_used = 0;
    let mut disk_total = 0;

    if let Some(disk) = disks.list().first() {
        disk_total = disk.total_space();
        disk_used = disk_total - disk.available_space();
    }

    let networks = Networks::new_with_refreshed_list();
    let mut mac_address: Option<String> = None;

    for (name, data) in &networks {
        if name.to_lowercase().contains("loopback") || name.to_lowercase().starts_with("lo") {
            continue;
        }
        
        let mac = data.mac_address().to_string();
        if mac != "00:00:00:00:00:00" {
            mac_address = Some(mac);
            break;
        }
    }

    let ip_address = std::net::UdpSocket::bind("0.0.0.0:0")
        .and_then(|s| s.connect("8.8.8.8:80").map(|_| s))
        .and_then(|s| s.local_addr())
        .map(|addr| addr.ip().to_string())
        .ok();

    // Evaluate DHCP once and cache it to save CPU ticks
    if dhcp_cache.is_none() && cfg!(target_os = "windows") {
        #[cfg(target_os = "windows")]
        use std::os::windows::process::CommandExt;

        let mut cmd = std::process::Command::new("ipconfig");
        cmd.arg("/all");
        
        #[cfg(target_os = "windows")]
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

        if let Ok(output) = cmd.output() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            if stdout.contains("DHCP Enabled. . . . . . . . . . . : Yes") {
                *dhcp_cache = Some(true);
            } else if stdout.contains("DHCP Enabled. . . . . . . . . . . : No") {
                *dhcp_cache = Some(false);
            }
        }
    }

    let hostname = System::host_name().unwrap_or_else(|| "Unknown".to_string());
    let os_version = System::os_version().unwrap_or_else(|| "Unknown".to_string());
    let device_type = "Desktop Agent".to_string();
    let agent_version = env!("CARGO_PKG_VERSION").to_string();
    let cpu_usage = sys.global_cpu_info().cpu_usage();

    TelemetryData {
        hostname,
        os_version,
        device_type,
        agent_version,
        cpu_usage,
        memory_used: sys.used_memory(),
        memory_total: sys.total_memory(),
        disk_used,
        disk_total,
        ip_address,
        mac_address,
        dhcp_enabled: *dhcp_cache,
    }
}
