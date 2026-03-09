"use client";

import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";

export interface TelemetryData {
    hostname: string;
    os_version: string;
    device_type?: string;
    agent_version?: string;
    cpu_usage: number;
    memory_used: number;
    memory_total: number;
    disk_used: number;
    disk_total: number;
    ip_address?: string;
    mac_address?: string;
    dhcp_enabled?: boolean;
    /** RustDesk peer ID reported by the agent. Null if RustDesk is not installed on the target. */
    rustdesk_id?: string | null;
    last_seen: Date;
}

export const useSightWebsocket = () => {
    const [agents, setAgents] = useState<Record<string, TelemetryData>>({});
    const [isConnected, setIsConnected] = useState(false);
    const ws = useRef<WebSocket>(null);

    useEffect(() => {
        let isMounted = true;
        let reconnectTimeout: NodeJS.Timeout;

        const connect = () => {
            if (!isMounted) return;

            ws.current = new WebSocket("ws://localhost:8080/ws");

            ws.current.onopen = () => {
                if (!isMounted) {
                    ws.current?.close();
                    return;
                }
                setIsConnected(true);
                console.log("Connected to S.I.G.H.T. Central Server");
            };

            ws.current.onmessage = (event) => {
                if (!isMounted) return;
                try {
                    const msg = JSON.parse(event.data);

                    if (msg.type === "TELEMETRY" && msg.payload && msg.payload.hostname) {
                        const raw = msg.payload;
                        setAgents((prev) => ({
                            ...prev,
                            [raw.hostname]: {
                                ...raw,
                                last_seen: new Date(),
                            },
                        }));
                    } else if (msg.type === "COMMAND_RESULT" && msg.payload && msg.target_hostname) {
                        const { success, output } = msg.payload;
                        const shortAction = msg.action ? msg.action.split(' ')[0] : 'Action';
                        if (success) {
                            toast.success(`[${msg.target_hostname}] ${shortAction} succeeded`, {
                                description: <pre className="mt-2 w-[340px] rounded-md bg-slate-950 p-4 whitespace-pre-wrap text-xs text-white max-h-[200px] overflow-y-auto"> {output} </pre>,
                                duration: 8000,
                            });
                        } else {
                            toast.error(`[${msg.target_hostname}] ${shortAction} failed`, {
                                description: <pre className="mt-2 w-[340px] rounded-md bg-slate-950 p-4 whitespace-pre-wrap text-red-400 text-xs max-h-[200px] overflow-y-auto"> {output} </pre>,
                                duration: 10000,
                            });
                        }
                    }
                } catch (error) {
                    console.error("Failed to parse websocket message:", error);
                }
            };

            ws.current.onclose = () => {
                if (!isMounted) return;
                setIsConnected(false);
                console.log("Disconnected from Central Server, retrying in 3s...");
                reconnectTimeout = setTimeout(connect, 3000);
            };

            ws.current.onerror = (error) => {
                if (!isMounted) return;
                // Ignore errors if the socket is already closing/closed (React Strict Mode unmount)
                if (ws.current?.readyState === WebSocket.CLOSING || ws.current?.readyState === WebSocket.CLOSED) {
                    return;
                }
                console.error("WebSocket Error:", error);
                ws.current?.close();
            };
        };

        connect();

        // Cleanup stale agents every 10 seconds
        const cleanupInterval = setInterval(() => {
            if (!isMounted) return;
            setAgents((currentAgents) => {
                const now = new Date();
                const nextAgents = { ...currentAgents };
                let changed = false;
                Object.keys(nextAgents).forEach((hostname) => {
                    // If haven't seen in 15 seconds, mark offline / remove
                    if (now.getTime() - nextAgents[hostname].last_seen.getTime() > 15000) {
                        delete nextAgents[hostname];
                        changed = true;
                    }
                });
                return changed ? nextAgents : currentAgents;
            });
        }, 10000);

        return () => {
            isMounted = false;
            clearTimeout(reconnectTimeout);
            clearInterval(cleanupInterval);
            if (ws.current?.readyState === WebSocket.OPEN || ws.current?.readyState === WebSocket.CONNECTING) {
                ws.current.close();
            }
        };
    }, []);

    const sendCommand = (target_hostname: string, action: string) => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({
                type: "COMMAND",
                target_hostname,
                action
            }));
            return true;
        }
        return false;
    };

    return { agents, isConnected, sendCommand };
};
