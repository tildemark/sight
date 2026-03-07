"use client";

import { AgentTable } from "@/components/AgentTable";
import { LogsTable } from "@/components/LogsTable";
import { ShieldAlert, Terminal, Server } from "lucide-react";
import { useState } from "react";

type ViewMode = "agents" | "logs";

export default function Home() {
  const [view, setView] = useState<ViewMode>("agents");

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header Section */}
        <header className="flex items-center justify-between border-b pb-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-3">
              <ShieldAlert className="h-8 w-8 text-blue-600" />
              S.I.G.H.T. Command Center
            </h1>
            <p className="text-muted-foreground">Real-time enterprise telemetry and threat monitoring.</p>
          </div>
          <div className="flex-shrink-0 flex items-center gap-6">
            <div className="flex bg-muted p-1 rounded-lg">
              <button
                onClick={() => setView("agents")}
                className={`px-4 py-2 text-sm font-medium rounded-md flex items-center gap-2 transition-all ${view === "agents" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10"
                  }`}
              >
                <Server className="h-4 w-4" /> Active Nodes
              </button>
              <button
                onClick={() => setView("logs")}
                className={`px-4 py-2 text-sm font-medium rounded-md flex items-center gap-2 transition-all ${view === "logs" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10"
                  }`}
              >
                <Terminal className="h-4 w-4" /> Audit Logs
              </button>
            </div>

            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80" className="h-12 w-auto shadow-sm rounded-md overflow-hidden">
              <rect width="120" height="80" fill="#e60000" />
              <text x="50%" y="54%" dominantBaseline="middle" textAnchor="middle" fill="#ffffff" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="56" letterSpacing="-2">AV</text>
            </svg>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="space-y-6">
          {view === "agents" ? <AgentTable /> : <LogsTable />}
        </main>

      </div>
    </div>
  );
}
