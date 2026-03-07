"use client";

import { useEffect, useState } from "react";
import { ShieldAlert, TerminalSquare, CheckCircle2, XCircle, Clock } from "lucide-react";

export interface AuditLog {
    id: string;
    hostname: string;
    action: string;
    success: boolean;
    details: string;
    timestamp: string;
}

export function LogsTable() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const response = await fetch("http://localhost:8080/api/logs");
                if (response.ok) {
                    const data = await response.json();
                    setLogs(data || []);
                }
            } catch (error) {
                console.error("Failed to fetch audit logs:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchLogs();
        // Optional: poll every 5s to keep it fresh without websockets 
        const interval = setInterval(fetchLogs, 5000);
        return () => clearInterval(interval);
    }, []);

    if (isLoading) {
        return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading Audit Logs...</div>;
    }

    return (
        <div className="space-y-4 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5 text-indigo-500" /> Security Audit Trail
                </h2>
                <div className="text-sm text-muted-foreground bg-secondary/50 px-3 py-1 rounded-full border">
                    Recent immutable records
                </div>
            </div>

            <div className="border rounded-md overflow-hidden bg-background shadow-sm">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs uppercase bg-muted text-muted-foreground border-b border-border">
                        <tr>
                            <th className="px-6 py-3 font-medium">Timestamp</th>
                            <th className="px-6 py-3 font-medium">Target Node</th>
                            <th className="px-6 py-3 font-medium">Action Sent</th>
                            <th className="px-6 py-3 font-medium">Execution Status</th>
                            <th className="px-6 py-3 font-medium text-right">Raw Output</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                                    No audit logs recorded yet.
                                </td>
                            </tr>
                        ) : (
                            logs.map((log) => {
                                // Parse the JSON string details into an object safely
                                let parsedDetails = log.details;
                                try {
                                    const parsed = JSON.parse(log.details);
                                    if (parsed.output) {
                                        parsedDetails = parsed.output;
                                    }
                                } catch (e) {
                                    // if it's not JSON, render it raw
                                }

                                return (
                                    <tr key={log.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-muted-foreground tabular-nums">
                                            <div className="flex items-center gap-2">
                                                <Clock className="h-3 w-3" />
                                                {new Date(log.timestamp).toLocaleString()}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-medium">{log.hostname}</td>
                                        <td className="px-6 py-4">
                                            <span className="font-mono text-xs bg-secondary px-2 py-1 rounded-sm border">
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {log.success ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-500 border border-green-500/20">
                                                    <CheckCircle2 className="h-3.5 w-3.5" /> Allowed / Succeeded
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-500 border border-red-500/20">
                                                    <XCircle className="h-3.5 w-3.5" /> Blocked / Failed
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="inline-flex group relative">
                                                <button className="text-muted-foreground hover:text-foreground">
                                                    <TerminalSquare className="h-4 w-4" />
                                                </button>

                                                {/* Tooltip for output */}
                                                <div className="invisible group-hover:visible absolute right-0 bottom-full mb-2 w-80 p-3 bg-slate-900 border border-slate-800 rounded-lg text-left shadow-xl z-50">
                                                    <p className="text-[10px] font-mono text-slate-300 break-words whitespace-pre-wrap max-h-48 overflow-y-auto">
                                                        {parsedDetails}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
