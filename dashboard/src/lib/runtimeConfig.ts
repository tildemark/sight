type RuntimeEndpoints = {
  wsUrl: string;
  apiUrl: string;
};

const LOCAL_WS_URL = "ws://localhost:8080/ws";
const LOCAL_API_URL = "http://localhost:8080";

function wsToApiUrl(wsUrl: string): string {
  const isSecure = wsUrl.startsWith("wss://");
  return wsUrl
    .replace(/^wss?:\/\//, isSecure ? "https://" : "http://")
    .replace(/\/ws$/, "");
}

function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function buildConfigCandidates(): string[] {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const normalizedBasePath = basePath && basePath !== "/" ? basePath.replace(/\/$/, "") : "";
  const candidates = [
    `${normalizedBasePath}/config.json`,
    "/config.json",
  ];

  return Array.from(new Set(candidates));
}

async function readConfigWsUrl(): Promise<string | null> {
  for (const candidate of buildConfigCandidates()) {
    try {
      const response = await fetch(candidate, { cache: "no-store" });
      if (!response.ok) {
        continue;
      }

      const config = await response.json();
      if (typeof config.server_url === "string" && config.server_url.trim()) {
        return config.server_url.trim();
      }
    } catch {
      // Try the next candidate path.
    }
  }

  return null;
}

export async function resolveRuntimeEndpoints(): Promise<RuntimeEndpoints> {
  const envWsUrl = process.env.NEXT_PUBLIC_SIGHT_SERVER_URL?.trim();
  const envApiUrl = process.env.NEXT_PUBLIC_SIGHT_API_URL?.trim();

  if (envWsUrl) {
    return {
      wsUrl: envWsUrl,
      apiUrl: envApiUrl || wsToApiUrl(envWsUrl),
    };
  }

  if (typeof window !== "undefined" && isLocalHost(window.location.hostname)) {
    return {
      wsUrl: LOCAL_WS_URL,
      apiUrl: LOCAL_API_URL,
    };
  }

  const configWsUrl = await readConfigWsUrl();
  if (configWsUrl) {
    return {
      wsUrl: configWsUrl,
      apiUrl: wsToApiUrl(configWsUrl),
    };
  }

  return {
    wsUrl: LOCAL_WS_URL,
    apiUrl: LOCAL_API_URL,
  };
}
