import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ShieldAlert, CheckCircle2, XCircle, Clock } from "lucide-react";

interface LocalLog {
    id: number;
    timestamp: string;
    action: string;
    status: string;
    output: string;
}

export function AuditLogs() {
    const [logs, setLogs] = useState<LocalLog[]>([]);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const fetchedLogs = await invoke<LocalLog[]>("get_local_logs");
                setLogs(fetchedLogs);
            } catch (e) {
                console.error("Failed to fetch local logs:", e);
            }
        };

        fetchLogs();
        const interval = setInterval(fetchLogs, 5000); // Polling for new logs
        return () => clearInterval(interval);
    }, []);

    const formatTime = (isoString: string) => {
        const d = new Date(isoString);
        return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
    };

    return (
        <div className="w-full max-w-lg bg-card rounded-xl border shadow-sm flex flex-col items-center p-4">
            <div className="flex items-center gap-2 mb-4 w-full border-b pb-2">
                <ShieldAlert className="h-5 w-5 text-orange-500" />
                <h2 className="text-lg font-semibold">IT Activity Log</h2>
            </div>

            <div className="w-full space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {logs.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8 italic text-sm">
                        No remote commands have been executed on this machine.
                    </div>
                ) : (
                    logs.map((log) => (
                        <div key={log.id} className="bg-muted/30 border border-border rounded-lg p-3 space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    {log.status === "Success" ? (
                                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    ) : log.status === "Denied" ? (
                                        <XCircle className="h-4 w-4 text-orange-500" />
                                    ) : (
                                        <XCircle className="h-4 w-4 text-red-500" />
                                    )}
                                    <span className="font-semibold text-sm truncate max-w-[200px]" title={log.action}>
                                        {log.action}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    {formatTime(log.timestamp)}
                                </div>
                            </div>
                            <div className="text-xs text-muted-foreground bg-background rounded p-2 font-mono whitespace-pre-wrap max-h-24 overflow-y-auto">
                                {log.output}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
