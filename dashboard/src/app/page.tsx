"use client";

import { AgentTable } from "@/components/AgentTable";
import { LogsTable } from "@/components/LogsTable";
import { Terminal, Server } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

type ViewMode = "agents" | "logs";

export default function Home() {
  const [view, setView] = useState<ViewMode>("agents");

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header Section */}
        <header className="flex items-stretch justify-between gap-6 border-b pb-6">
          <div className="flex min-h-32 flex-1 items-center gap-4 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950/90 px-6 py-5 text-white shadow-sm">
            <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-2xl bg-white/5 p-3 shadow-inner">
              <Image
                src="/sight-icon.png"
                alt="S.I.G.H.T icon"
                width={80}
                height={80}
                className="h-full w-full object-contain"
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200/80">
                System Inspection and Global Hardware Telemetry
              </p>
              <h1 className="text-3xl font-bold tracking-tight lg:text-4xl">
                S.I.G.H.T. Command Center
              </h1>
              <p className="max-w-2xl text-sm text-slate-300 lg:text-base">
                System Inspection and Global Hardware Telemetry for fleet control, audit visibility, and remote response in a single operator view.
              </p>
            </div>
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

            <Image
              src="/avlogo.jpg"
              alt="Avega company logo"
              width={160}
              height={64}
              className="h-14 w-auto rounded-lg object-contain"
            />
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
