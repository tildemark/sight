import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Save, Monitor, Eye, EyeOff, KeyRound, Info } from "lucide-react";

export function Settings() {
  const [serverUrl, setServerUrl] = useState("");
  const [fallbackUrl, setFallbackUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [rustdeskPassword, setRustdeskPassword] = useState("");
  const [rustdeskPasswordVisible, setRustdeskPasswordVisible] = useState(false);
  const [rustdeskPasswordSaving, setRustdeskPasswordSaving] = useState(false);
  const [rustdeskId, setRustdeskId] = useState<string | null>(null);
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [versionInfo, setVersionInfo] = useState<{
    agent_version: string;
    tauri_version: string;
    rust_version: string;
    os: string;
    arch: string;
  } | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const config: Record<string, string> = await invoke("get_config");
        setServerUrl(config["server_url"] || "");
        setFallbackUrl(config["fallback_config_url"] || "");
      } catch (e) {
        console.error("Failed to load config:", e);
      }
    };
    const fetchRustdeskId = async () => {
      try {
        const id: string | null = await invoke("get_rustdesk_id");
        setRustdeskId(id);
      } catch (e) {
        console.error("Failed to fetch RustDesk ID:", e);
      }
    };
    const fetchVersionInfo = async () => {
      try {
        const info = await invoke<{
          agent_version: string;
          tauri_version: string;
          rust_version: string;
          os: string;
          arch: string;
        }>("get_version_info");
        setVersionInfo(info);
      } catch (e) {
        console.error("Failed to fetch version info:", e);
      }
    };
    fetchConfig();
    fetchRustdeskId();
    fetchVersionInfo();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await invoke("set_config", { key: "server_url", value: serverUrl });
      await invoke("set_config", { key: "fallback_config_url", value: fallbackUrl });
      alert("Settings saved securely. The agent will use these on the next connection attempt.");
    } catch (e) {
      console.error("Failed to save config:", e);
      alert("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-lg space-y-4">
      <div className="bg-card p-5 rounded-xl border shadow-sm space-y-4 text-card-foreground">
        <div>
          <h2 className="text-lg font-semibold">Connection Settings</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Override the default server locations. Changes take effect on the next connection retry or agent restart.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Primary Server URL (WebSocket)</label>
          <input
            type="text"
            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            placeholder="wss://api.sight.local/ws"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Fallback Config URL (JSON)</label>
          <input
            type="text"
            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={fallbackUrl}
            onChange={(e) => setFallbackUrl(e.target.value)}
            placeholder="https://raw.githubusercontent.com/.../config.json"
          />
        </div>

        <button
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 font-medium text-sm transition-colors flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
          onClick={handleSave}
          disabled={saving}
        >
          <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Configuration"}
        </button>
      </div>

      {/* RustDesk Remote Access Settings */}
      <div className="bg-card p-5 rounded-xl border shadow-sm space-y-4 text-card-foreground">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Monitor className="h-5 w-5 text-sky-500" />
            RustDesk Remote Access
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Set an unattended password to allow remote access without user confirmation.
          </p>
        </div>

        {rustdeskId ? (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium">Peer ID</label>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold tracking-widest text-sky-400 bg-sky-500/10 border border-sky-500/20 px-3 py-2 rounded-md select-all flex-1">
                  {rustdeskId}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <KeyRound className="h-4 w-4" />
                Unattended Access Password
              </label>
              <div className="relative">
                <input
                  type={rustdeskPasswordVisible ? "text" : "password"}
                  className="w-full bg-background border border-input rounded-md px-3 py-2 pr-10 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={rustdeskPassword}
                  onChange={(e) => setRustdeskPassword(e.target.value)}
                  placeholder="Enter password for unattended access"
                />
                <button
                  type="button"
                  onClick={() => setRustdeskPasswordVisible(!rustdeskPasswordVisible)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {rustdeskPasswordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                This password will allow remote technicians to connect without user confirmation.
              </p>
            </div>

            <button
              className="w-full bg-sky-600 hover:bg-sky-700 text-white rounded-md px-4 py-2 font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              onClick={async () => {
                if (!rustdeskPassword.trim()) {
                  alert("Please enter a password.");
                  return;
                }
                setRustdeskPasswordSaving(true);
                try {
                  const result: boolean = await invoke("set_rustdesk_password", { password: rustdeskPassword });
                  if (result) {
                    alert("RustDesk password set successfully! Remote access is now enabled.");
                    setRustdeskPassword("");
                  } else {
                    alert("RustDesk is not installed on this machine.");
                  }
                } catch (e) {
                  console.error("Failed to set RustDesk password:", e);
                  alert("Failed to set password: " + e);
                } finally {
                  setRustdeskPasswordSaving(false);
                }
              }}
              disabled={rustdeskPasswordSaving || !rustdeskPassword.trim()}
            >
              <KeyRound className="h-4 w-4" /> {rustdeskPasswordSaving ? "Setting Password..." : "Set Unattended Password"}
            </button>
          </>
        ) : (
          <div className="bg-muted/50 rounded-md p-4 text-center">
            <p className="text-sm text-muted-foreground">
              RustDesk is not installed on this machine. Install RustDesk to enable remote access.
            </p>
          </div>
        )}
      </div>

      {/* About Section */}
      <div className="bg-card p-5 rounded-xl border shadow-sm text-card-foreground">
        <button
          className="w-full flex items-center justify-between"
          onClick={() => setAboutExpanded(!aboutExpanded)}
        >
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Info className="h-5 w-5 text-purple-500" />
            About
          </h2>
          <span className="text-muted-foreground">
            {aboutExpanded ? "▲" : "▼"}
          </span>
        </button>
        
        {aboutExpanded && (
          <div className="mt-4 space-y-3 pt-4 border-t">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Agent Version:</span>
              <span className="font-mono font-semibold">{versionInfo?.agent_version || "-"}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Tauri Version:</span>
              <span className="font-mono font-semibold">{versionInfo?.tauri_version || "-"}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Rust Version:</span>
              <span className="font-mono font-semibold">{versionInfo?.rust_version || "-"}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Platform:</span>
              <span className="font-mono font-semibold">{versionInfo?.os} ({versionInfo?.arch})</span>
            </div>
            <div className="pt-4 mt-4 border-t">
              <p className="text-sm text-center text-muted-foreground">
                Developed by{" "}
                <a 
                  href="https://sanchez.ph" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-medium"
                >
                  Alfredo Sanchez Jr
                </a>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
