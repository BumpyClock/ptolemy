import { AlertCircle, CheckCircle, Clock, Server, Users } from "lucide-react";
import type React from "react";
import { Badge } from "@/components/ui/Badge";
import { Separator } from "@/components/ui/Separator";
import type { McpServerConfig, McpServerStatus, McpSessionInfo } from "../types";

interface McpStatusBarProps {
  status: McpServerStatus;
  sessionInfo?: McpSessionInfo;
  config?: McpServerConfig;
  className?: string;
}

export const McpStatusBar: React.FC<McpStatusBarProps> = ({ status, sessionInfo, config, className }) => {
  const formatUptime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h ${minutes}m`;
    }
    return `${hours}h ${minutes}m ${secs}s`;
  };

  return (
    <div className={`flex flex-wrap items-center gap-4 text-sm ${className || ""}`}>
      <div className="flex items-center gap-2">
        {status.status === "running" ? (
          <CheckCircle className="h-4 w-4 text-foreground" />
        ) : (
          <AlertCircle className="h-4 w-4 text-destructive" />
        )}
        <Badge variant={status.status === "running" ? "success" : "warning"}>{status.status.toUpperCase()}</Badge>
      </div>

      <Separator orientation="vertical" className="h-4" />

      {status.uptime !== null && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>Up {formatUptime(status.uptime)}</span>
        </div>
      )}

      <Separator orientation="vertical" className="h-4" />

      <div className="flex items-center gap-2 text-muted-foreground">
        <Server className="h-4 w-4" />
        <span>MCP {config?.port || 8051}</span>
      </div>

      {sessionInfo && (
        <>
          <Separator orientation="vertical" className="h-4" />
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>Sessions: coming soon</span>
          </div>
        </>
      )}

      <Separator orientation="vertical" className="h-4" />

      <div className="flex items-center gap-2 text-muted-foreground">
        <span>Transport</span>
        <Badge variant="outline">
          {config?.transport === "streamable-http"
            ? "HTTP"
            : config?.transport === "sse"
              ? "SSE"
              : config?.transport || "HTTP"}
        </Badge>
      </div>
    </div>
  );
};
