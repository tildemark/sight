import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Activity, ShieldCheck, Cpu, HardDrive, ScrollText, LayoutDashboard, Settings as SettingsIcon, Monitor, ChevronDown, ChevronRight, Ticket, Wifi, RefreshCw, RotateCcw, Network, Terminal } from "lucide-react";
import { AuditLogs } from "./AuditLogs";
import { Settings } from "./Settings";

interface Telemetry {
  hostname: string;
  os_version: string;
  device_type: string;
  agent_version: string;
  cpu_usage: number;
  memory_used: number;
  memory_total: number;
  disk_used: number;
  disk_total: number;
  /** RustDesk peer ID for this machine. Null if RustDesk is not installed. */
  rustdesk_id?: string | null;
  /** Whether RustDesk has a password set for unattended access */
  rustdesk_password_set?: boolean;
}

function App() {
  const [ticketDescription, setTicketDescription] = useState("");
  const [stats, setStats] = useState<Telemetry | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"dashboard" | "logs" | "settings">("dashboard");
  const [supportFormExpanded, setSupportFormExpanded] = useState(false);
  const [quickToolsExpanded, setQuickToolsExpanded] = useState(false);
  const [runningCommand, setRunningCommand] = useState<string | null>(null);
  const [commandOutput, setCommandOutput] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await invoke<Telemetry>("get_local_telemetry");
        setStats(data);
      } catch (e) {
        console.error("Failed to fetch telemetry:", e);
      }
      try {
        const connected = await invoke<boolean>("get_connection_status");
        setIsConnected(connected);
      } catch (e) {
        console.error("Failed to fetch connection status:", e);
      }
    };

    // Fetch immediately and then poll every 3 seconds
    fetchStats();
    const interval = setInterval(fetchStats, 3000);
    return () => clearInterval(interval);
  }, []);

  // Run a local command (for quick tools)
  const runLocalCommand = async (command: string, label: string) => {
    setRunningCommand(label);
    setCommandOutput(null);
    try {
      const output = await invoke<string>("run_local_command", { command });
      setCommandOutput(output);
    } catch (e) {
      setCommandOutput(`Error: ${e}`);
    }
    setRunningCommand(null);
  };

  return (
    <div className="min-h-[100dvh] h-full bg-background text-foreground flex flex-col items-center p-6 space-y-6 overflow-y-auto">

      {/* Header */}
      <div className="relative w-full max-w-lg mb-2">
        <div className="absolute top-0 right-2">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80" className="h-7 w-auto shadow-sm rounded-md overflow-hidden opacity-90 transition-opacity hover:opacity-100">
            <rect width="120" height="80" fill="#e60000" />
            <text x="50%" y="54%" dominantBaseline="middle" textAnchor="middle" fill="#ffffff" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="56" letterSpacing="-2">AV</text>
          </svg>
        </div>
        <div className="text-center space-y-2 mt-4">
          <h1 className="text-3xl font-bold tracking-tight text-primary flex items-baseline justify-center gap-2">
            <ShieldCheck className="h-8 w-8 text-blue-600" />
            S.I.G.H.T.
            <span className="text-sm font-normal text-muted-foreground ml-1">v{stats?.agent_version || "1.0.0"}</span>
          </h1>
          <p className="text-sm text-muted-foreground">{stats?.hostname || "Unknown Host"} • {stats?.os_version || "Unknown OS"}</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex bg-muted/50 p-1 rounded-lg border w-full max-w-lg">
        <button
          onClick={() => setActiveTab("dashboard")}
          className={`flex-1 flex justify-center items-center gap-2 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === "dashboard" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
        >
          <LayoutDashboard className="h-4 w-4" /> System Agent
        </button>
        <button
          onClick={() => setActiveTab("logs")}
          className={`flex-1 flex justify-center items-center gap-2 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === "logs" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
        >
          <ScrollText className="h-4 w-4" /> Activity History
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`flex-1 flex justify-center items-center gap-2 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === "settings" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
        >
          <SettingsIcon className="h-4 w-4" /> Config
        </button>
      </div>

      {activeTab === "dashboard" ? (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-3 w-full max-w-lg">
            <div className="bg-card text-card-foreground p-3 rounded-xl border shadow-sm flex flex-col items-center justify-center space-y-2">
              <Cpu className="text-blue-500 h-6 w-6" />
              <span className="text-xs font-medium text-center">CPU Usage</span>
              <span className="text-xl font-bold text-green-500">
                {stats ? `${stats.cpu_usage.toFixed(1)}%` : "0%"}
              </span>
            </div>
            <div className="bg-card text-card-foreground p-3 rounded-xl border shadow-sm flex flex-col items-center justify-center space-y-2">
              <HardDrive className="text-purple-500 h-6 w-6" />
              <span className="text-xs font-medium text-center">RAM Usage (GB)</span>
              <span className="text-xl font-bold text-green-500 whitespace-nowrap">
                {stats
                  ? `${(stats.memory_used / 1024 / 1024 / 1024).toFixed(1)} / ${(stats.memory_total / 1024 / 1024 / 1024).toFixed(0)}`
                  : "0 / 0"}
              </span>
            </div>
            <div className="bg-card text-card-foreground p-3 rounded-xl border shadow-sm flex flex-col items-center justify-center space-y-2">
              <HardDrive className="text-orange-500 h-6 w-6" />
              <span className="text-xs font-medium text-center">Disk Usage (TB)</span>
              <span className="text-xl font-bold text-green-500 text-center whitespace-nowrap">
                {stats
                  ? `${(stats.disk_used / 1024 / 1024 / 1024 / 1024).toFixed(2)} / ${(stats.disk_total / 1024 / 1024 / 1024 / 1024).toFixed(1)}`
                  : "0 / 0"}
              </span>
            </div>
          </div>

          {/* Connection Status */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full border border-border ${isConnected ? 'bg-secondary/50' : 'bg-red-500/10'}`}>
            <div className={`h-2.5 w-2.5 rounded-full animate-pulse ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className={`text-sm font-medium flex items-center gap-2 ${isConnected ? 'text-secondary-foreground' : 'text-red-500'}`}>
              {isConnected ? (
                <>Connected to Central <Activity className="h-4 w-4 text-green-500" /></>
              ) : (
                <>Server Disconnected / Offline <Activity className="h-4 w-4 text-red-500" /></>
              )}
            </span>
          </div>

          {/* RustDesk Remote Access ID */}
          <div className="w-full max-w-sm bg-card p-4 rounded-xl border shadow-sm space-y-2">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Monitor className="h-4 w-4 text-sky-500" />
              RustDesk Remote Access
            </h3>
            {stats?.rustdesk_id ? (
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Peer ID</span>
                <span className="font-mono text-sm font-bold tracking-widest text-sky-400 bg-sky-500/10 border border-sky-500/20 px-3 py-1 rounded-md select-all">
                  {stats.rustdesk_id}
                </span>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                RustDesk not detected. Install RustDesk on this machine to enable remote access via the admin dashboard.
              </p>
            )}
          </div>

          {/* Quick Tools - for tech support requests */}
          <div className="w-full max-w-sm bg-card rounded-xl border shadow-sm mt-4 overflow-hidden">
            <button
              onClick={() => setQuickToolsExpanded(!quickToolsExpanded)}
              className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
            >
              <h3 className="font-semibold text-base flex items-center gap-2">
                <Terminal className="h-4 w-4 text-green-500" />
                Quick Tools
              </h3>
              <span className="text-xs text-muted-foreground mr-2">Run common network commands</span>
              {quickToolsExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            
            {quickToolsExpanded && (
              <div className="px-5 pb-5 space-y-3 animate-in slide-in-from-top-2 duration-200">
                <p className="text-xs text-muted-foreground">
                  Click a button to run a command. Use these when IT support asks you to troubleshoot connectivity issues.
                </p>
                
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => runLocalCommand("ipconfig /flushdns", "Flush DNS")}
                    disabled={runningCommand !== null}
                    className="px-3 py-2 bg-secondary text-secondary-foreground text-xs rounded-md hover:bg-secondary/80 disabled:opacity-50 flex items-center justify-start gap-2 border border-border"
                  >
                    <RefreshCw className="h-3 w-3" /> Flush DNS
                  </button>
                  <button
                    onClick={() => runLocalCommand("ipconfig /release", "Release IP")}
                    disabled={runningCommand !== null}
                    className="px-3 py-2 bg-secondary text-secondary-foreground text-xs rounded-md hover:bg-secondary/80 disabled:opacity-50 flex items-center justify-start gap-2 border border-border"
                  >
                    <RotateCcw className="h-3 w-3" /> Release IP
                  </button>
                  <button
                    onClick={() => runLocalCommand("ipconfig /renew", "Renew IP")}
                    disabled={runningCommand !== null}
                    className="px-3 py-2 bg-secondary text-secondary-foreground text-xs rounded-md hover:bg-secondary/80 disabled:opacity-50 flex items-center justify-start gap-2 border border-border"
                  >
                    <RotateCcw className="h-3 w-3" /> Renew IP
                  </button>
                  <button
                    onClick={() => runLocalCommand("netsh wlan show interfaces", "Show WiFi")}
                    disabled={runningCommand !== null}
                    className="px-3 py-2 bg-secondary text-secondary-foreground text-xs rounded-md hover:bg-secondary/80 disabled:opacity-50 flex items-center justify-start gap-2 border border-border"
                  >
                    <Wifi className="h-3 w-3" /> Show WiFi
                  </button>
                  <button
                    onClick={() => runLocalCommand("ipconfig /all", "IP Config")}
                    disabled={runningCommand !== null}
                    className="px-3 py-2 bg-secondary text-secondary-foreground text-xs rounded-md hover:bg-secondary/80 disabled:opacity-50 flex items-center justify-start gap-2 border border-border"
                  >
                    <Network className="h-3 w-3" /> IP Config
                  </button>
                  <button
                    onClick={() => runLocalCommand("ping 8.8.8.8 -n 4", "Ping Test")}
                    disabled={runningCommand !== null}
                    className="px-3 py-2 bg-secondary text-secondary-foreground text-xs rounded-md hover:bg-secondary/80 disabled:opacity-50 flex items-center justify-start gap-2 border border-border"
                  >
                    <Activity className="h-3 w-3" /> Ping Test
                  </button>
                </div>

                {/* Command Output */}
                {runningCommand && (
                  <div className="text-xs text-muted-foreground text-center py-2">
                    Running "{runningCommand}"...
                  </div>
                )}
                {commandOutput && (
                  <div className="bg-muted/50 rounded-md p-2 max-h-32 overflow-y-auto">
                    <pre className="text-xs font-mono whitespace-pre-wrap text-muted-foreground">
                      {commandOutput}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Collapsible Request IT Support Form */}
          <div className="w-full max-w-sm bg-card rounded-xl border shadow-sm mt-4 overflow-hidden">
            <button
              onClick={() => setSupportFormExpanded(!supportFormExpanded)}
              className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
            >
              <h3 className="font-semibold text-base flex items-center gap-2">
                <Ticket className="h-4 w-4 text-blue-500" />
                Request IT Support
              </h3>
              {supportFormExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            
            {supportFormExpanded && (
              <div className="px-5 pb-5 space-y-3 animate-in slide-in-from-top-2 duration-200">
                <textarea
                  placeholder="Describe your issue..."
                  className="w-full min-h-[80px] bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={ticketDescription}
                  onChange={(e) => setTicketDescription(e.target.value)}
                />
                <button
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 font-medium text-sm transition-colors"
                  onClick={() => {
                    alert("Ticket submitted securely!");
                    setTicketDescription("");
                  }}
                >
                  Submit Ticket
                </button>
              </div>
            )}
          </div>
        </>
      ) : activeTab === "logs" ? (
        <AuditLogs />
      ) : (
        <Settings />
      )}
    </div>
  );
}

export default App;
