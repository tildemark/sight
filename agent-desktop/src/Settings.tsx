import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Save } from "lucide-react";

export function Settings() {
  const [serverUrl, setServerUrl] = useState("");
  const [fallbackUrl, setFallbackUrl] = useState("");
  const [saving, setSaving] = useState(false);

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
    fetchConfig();
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
    </div>
  );
}
