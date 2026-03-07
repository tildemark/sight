"use client";

import { useSightWebsocket, TelemetryData } from "@/hooks/useSightWebsocket";
import { HardDrive, Cpu, ShieldCheck, Activity, Settings2, ChevronDown, ChevronRight, Power, RefreshCw, Network, Zap, DownloadCloud } from "lucide-react";
import { useState } from "react";

function AgentRow({ agent, sendCommand }: { agent: TelemetryData; sendCommand: (hostname: string, action: string) => boolean }) {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <>
            <tr
                className={`border-b border-border last:border-0 hover:bg-muted/50 transition-colors cursor-pointer ${isExpanded ? 'bg-muted/30' : ''}`}
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <td className="px-6 py-4">
                    <div className="flex items-center gap-2 font-medium">
                        {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        <ShieldCheck className="h-4 w-4 text-green-500" />
                        {agent.hostname}
                    </div>
                    {agent.agent_version && (
                        <div className="text-[10px] text-muted-foreground mt-1 ml-10 uppercase tracking-wider">
                            v{agent.agent_version}
                        </div>
                    )}
                </td>
                <td className="px-6 py-4 text-muted-foreground">{agent.os_version}</td>
                <td className="px-6 py-4">
                    <div className="flex items-center gap-2 font-medium text-xs">
                        {agent.cpu_usage < 80 && agent.memory_used / agent.memory_total < 0.8 ? (
                            <span className="text-green-500 flex items-center gap-1"><Activity className="h-3 w-3" /> Healthy</span>
                        ) : (
                            <span className="text-amber-500 flex items-center gap-1"><Activity className="h-3 w-3" /> Warning</span>
                        )}
                    </div>
                </td>
                <td className="px-6 py-4 flex justify-end">
                    <button className="text-xs text-muted-foreground hover:text-foreground">
                        {isExpanded ? "Collapse" : "Expand"}
                    </button>
                </td>
            </tr>
            {isExpanded && (
                <tr className="bg-muted/10 border-b border-border">
                    <td colSpan={4} className="px-6 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {/* Hardware Details Panel */}
                            <div className="space-y-4 bg-background border rounded-md p-4">
                                <h3 className="text-sm font-semibold flex items-center gap-2 border-b pb-2">
                                    <Activity className="h-4 w-4 text-blue-500" /> System Metrics
                                </h3>
                                <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm">
                                    <div className="text-muted-foreground font-medium">CPU Usage</div>
                                    <div className="flex items-center gap-2">
                                        <Cpu className="h-4 w-4 text-blue-500" />
                                        {agent.cpu_usage.toFixed(1)}%
                                    </div>
                                    <div className="text-muted-foreground font-medium">RAM Status</div>
                                    <div className="flex items-center gap-2">
                                        <HardDrive className="h-4 w-4 text-purple-500" />
                                        {(agent.memory_used / 1024 / 1024 / 1024).toFixed(1)} / {(agent.memory_total / 1024 / 1024 / 1024).toFixed(0)} GB
                                    </div>
                                    <div className="text-muted-foreground font-medium">Disk Space</div>
                                    <div className="flex items-center gap-2">
                                        <HardDrive className="h-4 w-4 text-orange-500" />
                                        {(agent.disk_used / 1024 / 1024 / 1024 / 1024).toFixed(2)} / {(agent.disk_total / 1024 / 1024 / 1024 / 1024).toFixed(1)} TB
                                    </div>
                                </div>
                            </div>

                            {/* Network Details Panel */}
                            <div className="space-y-4 bg-background border rounded-md p-4">
                                <h3 className="text-sm font-semibold flex items-center gap-2 border-b pb-2">
                                    <Network className="h-4 w-4 text-emerald-500" /> Network Config
                                </h3>
                                <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm">
                                    <div className="text-muted-foreground font-medium">IP Address</div>
                                    <div className="flex items-center gap-2 font-mono text-xs">
                                        {agent.ip_address || "Unavailable"}
                                    </div>
                                    <div className="text-muted-foreground font-medium">MAC Address</div>
                                    <div className="flex items-center gap-2 font-mono text-xs uppercase">
                                        {agent.mac_address || "Unavailable"}
                                    </div>
                                    <div className="text-muted-foreground font-medium">DHCP Status</div>
                                    <div className="flex items-center gap-2 text-xs">
                                        {agent.dhcp_enabled === true ? (
                                            <span className="text-green-500 rounded-full bg-green-500/10 px-2 py-0.5 border border-green-500/20">Enabled</span>
                                        ) : agent.dhcp_enabled === false ? (
                                            <span className="text-muted-foreground rounded-full bg-secondary px-2 py-0.5 border">Static IP</span>
                                        ) : (
                                            <span className="text-muted-foreground italic">Fetching...</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Remote Actions Panel */}
                            <div className="space-y-4 bg-background border rounded-md p-4">
                                <h3 className="text-sm font-semibold flex items-center gap-2 border-b pb-2">
                                    <Zap className="h-4 w-4 text-yellow-500" /> Remote Actions
                                </h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); sendCommand(agent.hostname, "ipconfig /flushdns"); }}
                                        className="px-3 py-2 bg-secondary text-secondary-foreground text-xs rounded-md hover:bg-secondary/80 flex items-center justify-start gap-2 border border-border">
                                        <Network className="h-4 w-4 text-blue-400" /> Flush DNS Cache
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (window.confirm("Are you sure you want to restart the Print Spooler?")) {
                                                sendCommand(agent.hostname, "net stop spooler && net start spooler");
                                            }
                                        }}
                                        className="px-3 py-2 bg-secondary text-secondary-foreground text-xs rounded-md hover:bg-secondary/80 flex items-center justify-start gap-2 border border-border">
                                        <Settings2 className="h-4 w-4 text-orange-400" /> Restart Spooler
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); sendCommand(agent.hostname, "ping 8.8.8.8 -n 4"); }}
                                        className="px-3 py-2 bg-secondary text-secondary-foreground text-xs rounded-md hover:bg-secondary/80 flex items-center justify-start gap-2 border border-border">
                                        <Activity className="h-4 w-4 text-green-400" /> Ping Internet
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (window.confirm("Are you sure you want to restart the Agent Service on this device?")) {
                                                sendCommand(agent.hostname, "powershell -Command \"Start-Sleep -Seconds 2; Restart-Service -Name AgentService -Force\"");
                                            }
                                        }}
                                        className="px-3 py-2 bg-destructive/10 text-destructive text-xs rounded-md hover:bg-destructive/20 flex items-center justify-start gap-2 border border-destructive/30">
                                        <RefreshCw className="h-4 w-4 text-destructive" /> Restart Agent
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (window.confirm("Are you sure you want to trigger an Over-The-Air Update? This will download the latest version from the S.I.G.H.T Central Server and momentarily take the agent offline while it reinstalls.")) {
                                                sendCommand(agent.hostname, "UPDATE_AGENT");
                                            }
                                        }}
                                        className="col-span-2 px-3 py-2 bg-blue-900/40 text-blue-300 text-xs rounded-md hover:bg-blue-800/60 flex items-center justify-center gap-2 border border-blue-500/50 mt-1">
                                        <DownloadCloud className="h-4 w-4" /> Push OTA Update
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (window.confirm("WARNING: Are you sure you want to forcefully restart this PC? Any unsaved work will be lost. The target user will be prompted to accept or deny.")) {
                                                sendCommand(agent.hostname, "shutdown /r /t 0");
                                            }
                                        }}
                                        className="col-span-2 px-3 py-2 bg-red-900/50 text-red-100 text-xs rounded-md hover:bg-red-800 flex items-center justify-center gap-2 border border-red-500/50 mt-1">
                                        <Power className="h-4 w-4" /> Force Restart PC
                                    </button>
                                </div>
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}

export function AgentTable() {
    const { agents, isConnected, sendCommand } = useSightWebsocket();
    const agentList = Object.values(agents).sort((a, b) => a.hostname.localeCompare(b.hostname));

    // Group agents by device_type
    const groupedAgents = agentList.reduce((acc, agent) => {
        const type = agent.device_type || "Unknown Device";
        if (!acc[type]) acc[type] = [];
        acc[type].push(agent);
        return acc;
    }, {} as Record<string, typeof agentList>);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold tracking-tight">Active Edge Nodes</h2>
                <div className="flex items-center gap-2">
                    <div className={`h-2.5 w-2.5 rounded-full ${isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"}`}></div>
                    <span className="text-sm font-medium text-muted-foreground">
                        {isConnected ? "Central Go DB Connected" : "Go DB Disconnected"}
                    </span>
                </div>
            </div>

            <div className="border rounded-md overflow-hidden bg-background">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs uppercase bg-muted text-muted-foreground border-b border-border">
                        <tr>
                            <th className="px-6 py-3 font-medium">Hostname</th>
                            <th className="px-6 py-3 font-medium">OS Version</th>
                            <th className="px-6 py-3 font-medium">System Health</th>
                            <th className="px-6 py-3 font-medium text-right font-medium">Details</th>
                        </tr>
                    </thead>
                    {agentList.length === 0 ? (
                        <tbody>
                            <tr className="border-b">
                                <td colSpan={4} className="px-6 py-4 text-center text-muted-foreground">
                                    No active S.I.G.H.T agents detected. Awaiting telemetry...
                                </td>
                            </tr>
                        </tbody>
                    ) : (
                        Object.entries(groupedAgents).map(([deviceType, group]) => (
                            <tbody key={deviceType}>
                                <tr className="bg-muted/30 border-b border-border">
                                    <td colSpan={4} className="px-6 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-secondary/20">
                                        {deviceType} ({group.length})
                                    </td>
                                </tr>
                                {group.map((agent) => (
                                    <AgentRow key={agent.hostname} agent={agent} sendCommand={sendCommand} />
                                ))}
                            </tbody>
                        ))
                    )}
                </table>
            </div>
        </div>
    );
}
