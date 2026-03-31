"use client";

import { useSightWebsocket, TelemetryData, CommandResultState } from "@/hooks/useSightWebsocket";
import { HardDrive, Cpu, ShieldCheck, Activity, Settings2, ChevronDown, ChevronRight, Power, RefreshCw, Network, Zap, DownloadCloud, Monitor, Wifi, AppWindow, FileText, Globe, Signal, RotateCcw, TerminalSquare, Clipboard, X, Gauge, Trash2, Server, Search, Play, List, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

// ── Toolbar primitives ──────────────────────────────────────────────────────
type TBVariant = "default" | "warning" | "danger" | "sky";

function ToolbarButton({
    icon: Icon,
    label,
    onClick,
    pending = false,
    elapsed = 0,
    iconClass = "text-muted-foreground",
    variant = "default" as TBVariant,
    disabled = false,
}: {
    icon: React.ElementType;
    label: string;
    onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
    pending?: boolean;
    elapsed?: number;
    iconClass?: string;
    variant?: TBVariant;
    disabled?: boolean;
}) {
    const variantBase =
        variant === "danger"  ? "hover:bg-red-900/30  text-red-300  hover:text-red-100" :
        variant === "warning" ? "hover:bg-amber-900/30 text-amber-200" :
        variant === "sky"     ? "hover:bg-sky-900/30   text-sky-300" :
                                "hover:bg-secondary    text-foreground/80";
    const pendingRing = pending
        ? variant === "danger" ? "ring-1 ring-red-500/50 bg-red-500/10" : "ring-1 ring-cyan-500/50 bg-cyan-500/10"
        : "";
    return (
        <div className="relative group/tbtn">
            <button
                disabled={disabled}
                onClick={onClick}
                className={`relative overflow-hidden p-2 rounded-md transition-colors flex items-center justify-center disabled:opacity-40 ${variantBase} ${pendingRing}`}
            >
                {pending && (
                    <span className={`absolute inset-0 rounded-md animate-pulse ${variant === "danger" ? "bg-red-500/15" : "bg-cyan-500/15"}`} />
                )}
                <Icon className={`h-4 w-4 relative z-10 ${iconClass}`} />
            </button>
            <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-popover text-popover-foreground border border-border rounded-md text-[11px] whitespace-nowrap opacity-0 group-hover/tbtn:opacity-100 transition-opacity z-50 shadow-lg">
                {pending ? `${label} (${elapsed}s)` : label}
            </div>
        </div>
    );
}

function ToolbarGroup({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-0.5">{label}</div>
            <div className="flex gap-0.5 bg-secondary/30 rounded-md border border-border/60 p-0.5">{children}</div>
        </div>
    );
}

function AgentRow({ agent, sendCommand, requestRustdeskSession, commandResult, clearCommandResult }: { agent: TelemetryData; sendCommand: (hostname: string, action: string) => boolean; requestRustdeskSession: (hostname: string, rustdeskId: string) => void; commandResult?: CommandResultState; clearCommandResult: (hostname: string) => void }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [pendingCommand, setPendingCommand] = useState<{ buttonId: string; action: string; startedAt: number } | null>(null);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);

    const runTrackedCommand = (buttonId: string, action: string) => {
        if (sendCommand(agent.hostname, action)) {
            setPendingCommand({ buttonId, action, startedAt: Date.now() });
            setElapsedSeconds(0);
        } else {
            toast.error(`Unable to send command to ${agent.hostname}. Check websocket connection.`);
        }
    };

    const isButtonPending = (buttonId: string) => pendingCommand?.buttonId === buttonId;

    /** Props for a simple tracked button */
    const tb = (buttonId: string, action: string) => ({
        pending: isButtonPending(buttonId),
        elapsed: elapsedSeconds,
        onClick: (e: React.MouseEvent<HTMLButtonElement>) => { e.stopPropagation(); runTrackedCommand(buttonId, action); },
    });

    /** Props for a tracked button that requires a confirm dialog */
    const tbConfirm = (buttonId: string, action: string, msg: string) => ({
        pending: isButtonPending(buttonId),
        elapsed: elapsedSeconds,
        onClick: (e: React.MouseEvent<HTMLButtonElement>) => { e.stopPropagation(); if (window.confirm(msg)) runTrackedCommand(buttonId, action); },
    });

    /** Props for a tracked button that requires a prompt dialog */
    const tbPrompt = (buttonId: string, promptMsg: string, defaultVal: string, makeAction: (v: string) => string) => ({
        pending: isButtonPending(buttonId),
        elapsed: elapsedSeconds,
        onClick: (e: React.MouseEvent<HTMLButtonElement>) => { e.stopPropagation(); const v = window.prompt(promptMsg, defaultVal); if (v) runTrackedCommand(buttonId, makeAction(v)); },
    });

    useEffect(() => {
        if (!pendingCommand) {
            setElapsedSeconds(0);
            return;
        }

        setElapsedSeconds(1);
        const timer = setInterval(() => {
            setElapsedSeconds(Math.max(1, Math.floor((Date.now() - pendingCommand.startedAt) / 1000)));
        }, 1000);

        return () => clearInterval(timer);
    }, [pendingCommand]);

    useEffect(() => {
        if (!pendingCommand || !commandResult) {
            return;
        }

        if (commandResult.action === pendingCommand.action) {
            setPendingCommand(null);
        }
    }, [commandResult, pendingCommand]);

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
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* ── System Metrics Panel (read-only telemetry) ── */}
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

                            {/* ── Network Config Panel (read-only telemetry) ── */}
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
                                    <div className="text-muted-foreground font-medium">RustDesk ID</div>
                                    <div className="flex items-center gap-2 font-mono text-xs">
                                        {agent.rustdesk_id ? (
                                            <span className="text-sky-400 font-bold tracking-widest select-all">
                                                {agent.rustdesk_id}
                                            </span>
                                        ) : (
                                            <span className="text-muted-foreground italic">Not installed</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* ── Remote Control (fire-and-forget icon toolbar) ── */}
                            <div className="md:col-span-2 bg-background border rounded-md p-3 space-y-2">
                                <h3 className="text-sm font-semibold flex items-center gap-2 border-b pb-2">
                                    <Zap className="h-4 w-4 text-yellow-500" /> Remote Control
                                </h3>
                                <div className="flex flex-wrap gap-3 items-start">
                                    <ToolbarGroup label="Quick Actions">
                                        <ToolbarButton icon={Activity}     label="Task Manager"     iconClass="text-orange-400" onClick={(e) => { e.stopPropagation(); sendCommand(agent.hostname, "taskmgr"); }} />
                                        <ToolbarButton icon={RefreshCw}    label="Restart Explorer" iconClass="text-blue-400"   onClick={(e) => { e.stopPropagation(); sendCommand(agent.hostname, "taskkill /f /im explorer.exe && start explorer.exe"); }} />
                                    </ToolbarGroup>
                                    <ToolbarGroup label="Agent">
                                        <ToolbarButton icon={RefreshCw} label="Restart Agent" iconClass="text-amber-400" variant="warning"
                                            onClick={(e) => { e.stopPropagation(); if (window.confirm("Restart the Agent Service on this device?")) sendCommand(agent.hostname, "powershell -Command \"Start-Sleep -Seconds 2; Restart-Service -Name AgentService -Force\""); }} />
                                        <ToolbarButton icon={Monitor}
                                            label={agent.rustdesk_id ? `Connect RustDesk (${agent.rustdesk_id})` : "RustDesk Not Installed"}
                                            iconClass={agent.rustdesk_id ? "text-sky-400" : "text-muted-foreground"}
                                            variant={agent.rustdesk_id ? "sky" : "default"}
                                            disabled={!agent.rustdesk_id}
                                            onClick={(e) => { e.stopPropagation(); toast.info("Remote Desktop request sent — waiting for user consent..."); requestRustdeskSession(agent.hostname, agent.rustdesk_id!); }} />
                                    </ToolbarGroup>
                                    <ToolbarGroup label="Danger Zone">
                                        <ToolbarButton icon={DownloadCloud} label="Push OTA Update"  iconClass="text-blue-400"
                                            onClick={(e) => { e.stopPropagation(); if (window.confirm("Trigger OTA update? The agent will go offline momentarily to reinstall.")) sendCommand(agent.hostname, "UPDATE_AGENT"); }} />
                                        <ToolbarButton icon={Power}         label="Force Restart PC" iconClass="text-red-400" variant="danger"
                                            onClick={(e) => { e.stopPropagation(); if (window.confirm("WARNING: Force restart PC? All unsaved work will be lost.")) sendCommand(agent.hostname, "shutdown /r /t 0"); }} />
                                    </ToolbarGroup>
                                </div>
                            </div>

                            {/* ── Command Output (icon toolbars + output area) ── */}
                            <div className="md:col-span-2 bg-background border rounded-md p-3 space-y-3">
                                <div className="flex items-center justify-between border-b pb-2">
                                    <h3 className="text-sm font-semibold flex items-center gap-2">
                                        <TerminalSquare className="h-4 w-4 text-emerald-400" /> Command Output
                                    </h3>
                                    {commandResult && (
                                        <button onClick={(e) => { e.stopPropagation(); clearCommandResult(agent.hostname); }}
                                            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                                            <X className="h-3 w-3" /> Clear
                                        </button>
                                    )}
                                </div>

                                {/* Toolbar groups */}
                                <div className="flex flex-wrap gap-3 items-start">
                                    <ToolbarGroup label="Network">
                                        <ToolbarButton icon={Network} label="Flush DNS Cache"      iconClass="text-blue-400"    {...tb("flush-dns",     "ipconfig /flushdns")} />
                                        <ToolbarButton icon={Activity} label="Ping Internet (4x)"  iconClass="text-green-400"   {...tb("ping-internet", "ping 8.8.8.8 -n 4")} />
                                        <ToolbarButton icon={Wifi}    label="WiFi SSID & Signal"   iconClass="text-emerald-400" {...tb("wifi-ssid",     "netsh wlan show interfaces")} />
                                        <ToolbarButton icon={Globe}   label="DNS Lookup"            iconClass="text-cyan-400"    {...tbPrompt("dns-lookup",  "Domain for DNS lookup:",     "google.com", (d) => "nslookup " + d)} />
                                        <ToolbarButton icon={Signal}  label="Trace Route"           iconClass="text-violet-400"  {...tbPrompt("trace-route", "Target IP or hostname:",      "8.8.8.8",    (t) => "tracert "  + t)} />
                                        <ToolbarButton icon={Gauge}   label="Internet Speed Test (Down/Up)"   iconClass="text-amber-400"
                                            {...tb("speed-test", "SIGHT_SPEEDTEST")} />
                                        <ToolbarButton icon={Server}  label="LAN / WiFi Adapter Info" iconClass="text-sky-400"
                                            {...tb("lan-info", "powershell -Command \"Get-NetAdapter | Where-Object {$_.Status -eq 'Up'} | Select-Object Name, InterfaceDescription, @{N='LinkSpeed';E={$_.LinkSpeed}}, MacAddress | Format-Table -AutoSize | Out-String -Width 4096\"")} />
                                    </ToolbarGroup>

                                    <ToolbarGroup label="Software">
                                        <ToolbarButton icon={AppWindow} label="All Installed Programs"  iconClass="text-sky-400"
                                            {...tb("all-programs", "powershell -Command \"Get-ItemProperty 'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*', 'HKLM:\\Software\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*' | Where-Object { $_.DisplayName } | Select-Object DisplayName, DisplayVersion, Publisher | Sort-Object DisplayName | Format-Table -AutoSize | Out-String -Width 4096\"")} />
                                        <ToolbarButton icon={Search}    label="Search Installed App"     iconClass="text-amber-400"
                                            {...tbPrompt("search-app", "App name to search (partial):", "", (app) => "powershell -Command \"Get-ItemProperty 'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*', 'HKLM:\\Software\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*' | Where-Object { $_.DisplayName -like '*" + app + "*' } | Select-Object DisplayName, DisplayVersion, Publisher | Format-Table -AutoSize | Out-String -Width 4096\"")} />
                                        <ToolbarButton icon={Monitor}   label="Microsoft Store Apps"     iconClass="text-indigo-400"
                                            {...tb("store-apps", "powershell -Command \"Get-AppxPackage | Select-Object Name, Version, Publisher | Sort-Object Name | Format-Table -AutoSize | Out-String -Width 4096\"")} />
                                        <ToolbarButton icon={Play}      label="Startup Programs"         iconClass="text-yellow-400"
                                            {...tb("startup", "powershell -Command \"$items = Get-CimInstance Win32_StartupCommand | Select-Object Name, Command, Location, User | Sort-Object Name; if ($items) { $items | ConvertTo-Json -Depth 4 } else { 'No startup programs found.' }\"")} />
                                    </ToolbarGroup>

                                    <ToolbarGroup label="Processes">
                                        <ToolbarButton icon={Cpu}    label="Running Processes (Top 50 by CPU)" iconClass="text-emerald-400"
                                            {...tb("processes", "powershell -Command \"Get-Process | Sort-Object CPU -Descending | Select-Object -First 50 Name, Id, @{N='CPU(s)';E={[math]::Round($_.CPU,1)}}, @{N='RAM(MB)';E={[math]::Round($_.WorkingSet64/1MB,1)}} | Format-Table -AutoSize | Out-String -Width 4096\"")} />
                                        <ToolbarButton icon={List}   label="Running Services"                   iconClass="text-purple-400"
                                            {...tb("services", "powershell -Command \"Get-Service | Where-Object {$_.Status -eq 'Running'} | Select-Object Name, DisplayName | Sort-Object DisplayName | Format-Table -AutoSize | Out-String -Width 4096\"")} />
                                        <ToolbarButton icon={Trash2} label="Kill Process (by name)"             iconClass="text-red-400" variant="danger"
                                            pending={isButtonPending("kill-process")} elapsed={elapsedSeconds}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const name = window.prompt("Exact process image name to kill (e.g. notepad.exe):");
                                                if (name && window.confirm(`Force-kill "${name}" on ${agent.hostname}? This is immediate.`)) {
                                                    runTrackedCommand("kill-process", "taskkill /F /IM " + name);
                                                }
                                            }} />
                                    </ToolbarGroup>

                                    <ToolbarGroup label="Logs">
                                        <ToolbarButton icon={FileText} label="Application Log (Last 100)" iconClass="text-orange-400"
                                            {...tb("app-logs", "powershell -Command \"Get-EventLog -LogName Application -Newest 100 | Select-Object TimeGenerated, EntryType, Source, EventID, Message | Format-Table -AutoSize -Wrap | Out-String -Width 4096\"")} />
                                        <ToolbarButton icon={AlertTriangle} label="System Errors/Critical (Last 100)" iconClass="text-red-400"
                                            {...tb("sys-errors", "powershell -Command \"Get-WinEvent -FilterHashtable @{LogName='System'; Level=@(1,2)} -MaxEvents 100 | Select-Object TimeCreated, LevelDisplayName, ProviderName, Id, Message | Format-Table -AutoSize -Wrap | Out-String -Width 4096\"")} />
                                        <ToolbarButton icon={ShieldCheck} label="Security Log (Last 100)" iconClass="text-yellow-400"
                                            {...tb("security-logs", "powershell -Command \"Get-WinEvent -FilterHashtable @{LogName='Security'} -MaxEvents 100 | Select-Object TimeCreated, Id, ProviderName, Message | Format-Table -AutoSize -Wrap | Out-String -Width 4096\"")} />
                                        <ToolbarButton icon={AlertTriangle} label="All Error Logs (Top 150)" iconClass="text-rose-400"
                                            {...tb("all-error-logs", "powershell -Command \"Get-WinEvent -FilterHashtable @{Level=@(1,2)} -MaxEvents 150 | Select-Object TimeCreated, LogName, LevelDisplayName, ProviderName, Id, Message | Format-Table -AutoSize -Wrap | Out-String -Width 4096\"")} />
                                    </ToolbarGroup>

                                    <ToolbarGroup label="Recovery">
                                        <ToolbarButton icon={Settings2}  label="Restart Print Spooler"   iconClass="text-orange-400" {...tbConfirm("restart-spooler", "net stop spooler && net start spooler", "Restart the Print Spooler service?")} />
                                        <ToolbarButton icon={RotateCcw}  label="Release IP Address"      iconClass="text-red-400"    {...tbConfirm("release-ip",      "ipconfig /release",    "Release IP? Network will disconnect temporarily.")} />
                                        <ToolbarButton icon={RefreshCw}  label="Renew IP Address"        iconClass="text-green-400"  {...tbConfirm("renew-ip",         "ipconfig /renew",     "Renew the IP address?")} />
                                        <ToolbarButton icon={Zap}        label="Reset Winsock Stack"     iconClass="text-rose-400" variant="danger" {...tbConfirm("reset-winsock", "netsh winsock reset", "WARNING: Reset Winsock? Network may drop temporarily.")} />
                                        <ToolbarButton icon={Network}    label="Reset TCP/IP Stack"      iconClass="text-rose-300" variant="danger" {...tbConfirm("reset-tcpip",   "netsh int ip reset",  "WARNING: Reset TCP/IP? Network may drop temporarily.")} />
                                    </ToolbarGroup>
                                </div>

                                {/* Output area */}
                                {!commandResult ? (
                                    <div className="text-xs text-muted-foreground italic border border-dashed border-border rounded-md p-4 min-h-[160px] flex items-center justify-center text-center">
                                        Run any command above to view full output here.
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex items-center justify-between text-xs">
                                            <span className={`px-2 py-1 rounded-full border ${commandResult.success ? "text-green-400 border-green-500/40 bg-green-500/10" : "text-red-300 border-red-500/40 bg-red-500/10"}`}>
                                                {commandResult.success ? "Succeeded" : "Failed"}
                                            </span>
                                            <span className="text-muted-foreground">{commandResult.receivedAt.toLocaleTimeString()}</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3 text-xs">
                                            <div className="text-muted-foreground min-w-0">
                                                Action: <span className="font-mono text-foreground break-all">{commandResult.action}</span>
                                            </div>
                                            <button
                                                onClick={async (e) => { e.stopPropagation(); try { await navigator.clipboard.writeText(commandResult.action); toast.success("Copied action"); } catch { toast.error("Failed to copy"); } }}
                                                className="shrink-0 px-2.5 py-1.5 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 flex items-center gap-1.5 border border-border"
                                            >
                                                <Clipboard className="h-3.5 w-3.5" /> Copy Action
                                            </button>
                                        </div>
                                        <div className="bg-slate-950 border border-slate-800 rounded-md p-3 min-h-[220px] max-h-[420px] overflow-auto">
                                            <pre className="text-xs text-slate-100 whitespace-pre-wrap break-words leading-relaxed">{commandResult.output}</pre>
                                        </div>
                                        <button
                                            onClick={async (e) => { e.stopPropagation(); try { await navigator.clipboard.writeText(commandResult.output); toast.success("Copied output"); } catch { toast.error("Failed to copy"); } }}
                                            className="w-full px-3 py-2 bg-secondary text-secondary-foreground text-xs rounded-md hover:bg-secondary/80 flex items-center justify-center gap-2 border border-border"
                                        >
                                            <Clipboard className="h-3.5 w-3.5" /> Copy Output
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}

export function AgentTable() {
    const { agents, commandResults, isConnected, sendCommand, requestRustdeskSession, clearCommandResult } = useSightWebsocket();
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
                                    <AgentRow
                                        key={agent.hostname}
                                        agent={agent}
                                        sendCommand={sendCommand}
                                        requestRustdeskSession={requestRustdeskSession}
                                        commandResult={commandResults[agent.hostname]}
                                        clearCommandResult={clearCommandResult}
                                    />
                                ))}
                            </tbody>
                        ))
                    )}
                </table>
            </div>
        </div>
    );
}
