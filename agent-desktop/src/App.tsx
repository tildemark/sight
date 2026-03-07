import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Activity, ShieldCheck, Cpu, HardDrive, ScrollText, LayoutDashboard } from "lucide-react";
import { AuditLogs } from "./AuditLogs";

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
}

function App() {
  const [ticketDescription, setTicketDescription] = useState("");
  const [stats, setStats] = useState<Telemetry | null>(null);
  const [activeTab, setActiveTab] = useState<"dashboard" | "logs">("dashboard");

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await invoke<Telemetry>("get_local_telemetry");
        setStats(data);
      } catch (e) {
        console.error("Failed to fetch telemetry:", e);
      }
    };

    // Fetch immediately and then poll every 3 seconds
    fetchStats();
    const interval = setInterval(fetchStats, 3000);
    return () => clearInterval(interval);
  }, []);

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
          <div className="flex items-center gap-2 bg-secondary/50 px-4 py-2 rounded-full border border-border">
            <div className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-sm font-medium text-secondary-foreground flex items-center gap-2">
              Connected to Central <Activity className="h-4 w-4 text-green-500" />
            </span>
          </div>

          {/* Simple Ticketing Form */}
          <div className="w-full max-w-sm space-y-3 bg-card p-5 rounded-xl border shadow-sm mt-4">
            <h3 className="font-semibold text-base flex items-center gap-2">Request IT Support</h3>
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
        </>
      ) : (
        <AuditLogs />
      )}
    </div>
  );
}

export default App;
