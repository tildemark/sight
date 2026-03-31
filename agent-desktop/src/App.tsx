import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Activity, ShieldCheck, Cpu, HardDrive, ScrollText, LayoutDashboard, Settings as SettingsIcon, Monitor, ChevronDown, ChevronRight, Ticket, Wifi, RefreshCw, RotateCcw, Network, Terminal, Server, Building2 } from "lucide-react";
import { AuditLogs } from "./AuditLogs";
import { Settings } from "./Settings";

interface Company {
  id: number;
  name: string;
}

interface Department {
  id: number;
  name: string;
}

interface Employee {
  id: number;
  name: string;
  company_id?: number | null;
  department_id?: number | null;
}

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
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | "">("");
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | "">("");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | "">("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [ticketStatus, setTicketStatus] = useState<string | null>(null);
  const [ticketError, setTicketError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isLoadingTicketOptions, setIsLoadingTicketOptions] = useState(false);
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);
  const [stats, setStats] = useState<Telemetry | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isAbasOnline, setIsAbasOnline] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<"dashboard" | "logs" | "settings">("dashboard");
  const [supportFormExpanded, setSupportFormExpanded] = useState(false);
  const [quickToolsExpanded, setQuickToolsExpanded] = useState(false);
  const [runningCommand, setRunningCommand] = useState<string | null>(null);
  const [commandOutput, setCommandOutput] = useState<string | null>(null);

  const logoutTicketSession = (statusMessage?: string) => {
    setAuthToken(null);
    setCompanies([]);
    setDepartments([]);
    setEmployees([]);
    setSelectedCompanyId("");
    setSelectedDepartmentId("");
    setSelectedEmployeeId("");
    setTicketDescription("");
    setPassword("");
    setTicketError(null);
    setTicketStatus(statusMessage ?? "Logged out of ticket session.");
  };

  const handleCommandError = (error: unknown, fallbackMessage: string): string => {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("HTTP_401")) {
      logoutTicketSession("Session expired. Please authenticate again.");
      return "Session expired. Please authenticate again.";
    }
    return message || fallbackMessage;
  };

  const filteredEmployees = useMemo(
    () =>
      employees.filter((employee) => {
        const companyMatches =
          selectedCompanyId === "" ||
          employee.company_id == null ||
          employee.company_id === selectedCompanyId;
        const departmentMatches =
          selectedDepartmentId === "" ||
          employee.department_id == null ||
          employee.department_id === selectedDepartmentId;
        return companyMatches && departmentMatches;
      }),
    [employees, selectedCompanyId, selectedDepartmentId]
  );

  const loadTicketOptions = async (token: string) => {
    setIsLoadingTicketOptions(true);
    setTicketError(null);

    try {
      const [companyOptions, departmentOptions, employeeOptions] = await Promise.all([
        invoke<Company[]>("avega_get_companies", { token }),
        invoke<Department[]>("avega_get_departments", { token }),
        invoke<Employee[]>("avega_get_employees", { token }),
      ]);

      setCompanies(companyOptions);
      setDepartments(departmentOptions);
      setEmployees(employeeOptions);
    } catch (error) {
      console.error("Failed to load ticket options:", error);
      setTicketError(handleCommandError(error, "Authenticated, but failed to load ticket options."));
    } finally {
      setIsLoadingTicketOptions(false);
    }
  };

  const handleTicketLogin = async () => {
    if (!username.trim() || !password) {
      setTicketError("Username and password are required.");
      return;
    }

    setIsLoggingIn(true);
    setTicketError(null);
    setTicketStatus(null);

    try {
      const token = await invoke<string>("avega_login", {
        username: username.trim(),
        password,
      });

      setAuthToken(token);
      setTicketStatus("Authentication successful. You can now submit a ticket.");
      await loadTicketOptions(token);
    } catch (error) {
      const errorMessage = handleCommandError(error, "Authentication failed.");
      setTicketError(errorMessage);
      setAuthToken(null);
      setCompanies([]);
      setDepartments([]);
      setEmployees([]);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSubmitTicket = async () => {
    if (!authToken) {
      setTicketError("Please authenticate before sending a ticket.");
      return;
    }
    if (selectedEmployeeId === "") {
      setTicketError("Employee name is required.");
      return;
    }
    if (selectedCompanyId === "") {
      setTicketError("Company is required.");
      return;
    }
    if (selectedDepartmentId === "") {
      setTicketError("Department is required.");
      return;
    }
    if (!ticketDescription.trim()) {
      setTicketError("Please describe the issue.");
      return;
    }

    setIsSubmittingTicket(true);
    setTicketError(null);
    setTicketStatus(null);

    try {
      const selectedEmployee = employees.find((employee) => employee.id === selectedEmployeeId);
      if (!selectedEmployee) {
        throw new Error("Selected employee was not found.");
      }

      await invoke("avega_submit_ticket", {
        token: authToken,
        departmentId: selectedDepartmentId,
        companyId: selectedCompanyId,
        requestorId: selectedEmployee.id,
        requestor: selectedEmployee.name,
        request: ticketDescription.trim(),
      });

      setTicketStatus("Ticket submitted successfully.");
      setSelectedEmployeeId("");
      setSelectedCompanyId("");
      setSelectedDepartmentId("");
      setTicketDescription("");
    } catch (error) {
      const errorMessage = handleCommandError(error, "Failed to submit ticket.");
      setTicketError(errorMessage);
    } finally {
      setIsSubmittingTicket(false);
    }
  };

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

  useEffect(() => {
    let mounted = true;

    const checkAbasStatus = async () => {
      try {
        const online = await invoke<boolean>("get_abas_status");
        if (mounted) {
          setIsAbasOnline(online);
        }
      } catch {
        if (mounted) {
          setIsAbasOnline(false);
        }
      }
    };

    checkAbasStatus();
    const interval = setInterval(checkAbasStatus, 30000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (selectedEmployeeId === "") {
      return;
    }

    const stillValid = filteredEmployees.some((employee) => employee.id === selectedEmployeeId);
    if (!stillValid) {
      setSelectedEmployeeId("");
    }
  }, [selectedEmployeeId, filteredEmployees]);

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
        <div className="absolute top-0 left-2">
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

          {/* Status Icons */}
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              title={isConnected ? "Connected to Central" : "Central server offline or disconnected"}
              className={`h-10 w-10 rounded-full border flex items-center justify-center transition-colors ${
                isConnected ? "bg-green-500/10 border-green-500/30 text-green-600" : "bg-red-500/10 border-red-500/30 text-red-500"
              }`}
              aria-label={isConnected ? "Connected to Central" : "Central server offline or disconnected"}
            >
              <Server className="h-5 w-5" />
            </button>

            <button
              type="button"
              title={
                isAbasOnline === null
                  ? "Checking ABAS ERP status"
                  : isAbasOnline
                    ? "ABAS ERP is online"
                    : "ABAS ERP is offline"
              }
              className={`h-10 w-10 rounded-full border flex items-center justify-center transition-colors ${
                isAbasOnline === null
                  ? "bg-muted/40 border-border text-muted-foreground"
                  : isAbasOnline
                    ? "bg-green-500/10 border-green-500/30 text-green-600"
                    : "bg-red-500/10 border-red-500/30 text-red-500"
              }`}
              aria-label={
                isAbasOnline === null
                  ? "Checking ABAS ERP status"
                  : isAbasOnline
                    ? "ABAS ERP is online"
                    : "ABAS ERP is offline"
              }
            >
              <Building2 className="h-5 w-5" />
            </button>
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
                {!authToken ? (
                  <>
                    <p className="text-xs text-muted-foreground">
                      Authenticate first to receive an access token before sending a ticket.
                    </p>
                    <input
                      type="text"
                      placeholder="API Username"
                      className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                    <input
                      type="password"
                      placeholder="API Password"
                      className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      className="w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 font-medium text-sm transition-colors disabled:opacity-60"
                      onClick={handleTicketLogin}
                      disabled={isLoggingIn}
                    >
                      {isLoggingIn ? "Authenticating..." : "Authenticate"}
                    </button>
                  </>
                ) : (
                  <>
                    <div className="text-xs text-green-600 bg-green-500/10 border border-green-500/20 rounded-md px-3 py-2 flex items-center justify-between gap-3">
                      <span>Authenticated. Your bearer token is active for this session.</span>
                      <button
                        className="text-[11px] font-semibold text-green-700 hover:underline"
                        onClick={() => logoutTicketSession()}
                        type="button"
                      >
                        Logout
                      </button>
                    </div>
                    <select
                      className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={selectedCompanyId}
                      onChange={(e) => {
                        const value = e.target.value;
                        setSelectedCompanyId(value ? Number(value) : "");
                      }}
                      disabled={isLoadingTicketOptions}
                    >
                      <option value="">Select Company</option>
                      {companies.map((company) => (
                        <option key={company.id} value={company.id}>
                          {company.name}
                        </option>
                      ))}
                    </select>
                    <select
                      className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={selectedDepartmentId}
                      onChange={(e) => {
                        const value = e.target.value;
                        setSelectedDepartmentId(value ? Number(value) : "");
                      }}
                      disabled={isLoadingTicketOptions}
                    >
                      <option value="">Select Department</option>
                      {departments.map((department) => (
                        <option key={department.id} value={department.id}>
                          {department.name}
                        </option>
                      ))}
                    </select>
                    <select
                      className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={selectedEmployeeId}
                      onChange={(e) => {
                        const value = e.target.value;
                        setSelectedEmployeeId(value ? Number(value) : "");
                      }}
                      disabled={isLoadingTicketOptions}
                    >
                      <option value="">Select Employee Name</option>
                      {filteredEmployees.map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {employee.name}
                        </option>
                      ))}
                    </select>
                    <textarea
                      placeholder="Describe your issue..."
                      className="w-full min-h-[80px] bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={ticketDescription}
                      onChange={(e) => setTicketDescription(e.target.value)}
                    />
                    <button
                      className="w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 font-medium text-sm transition-colors disabled:opacity-60"
                      onClick={handleSubmitTicket}
                      disabled={isSubmittingTicket || isLoadingTicketOptions}
                    >
                      {isSubmittingTicket ? "Submitting..." : "Submit Ticket"}
                    </button>
                  </>
                )}

                {ticketStatus && (
                  <div className="text-xs text-green-600 bg-green-500/10 border border-green-500/20 rounded-md px-3 py-2">
                    {ticketStatus}
                  </div>
                )}
                {ticketError && (
                  <div className="text-xs text-red-600 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
                    {ticketError}
                  </div>
                )}
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
