import { Activity, Clock, Monitor } from "lucide-react";
import type React from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import type { McpClient } from "../types";

interface McpClientListProps {
  clients: McpClient[];
  className?: string;
}

const clientIcons: Record<string, string> = {
  Claude: "🤖",
  Cursor: "💻",
  Windsurf: "🏄",
  Cline: "🔧",
  KiRo: "🚀",
  Augment: "⚡",
  Gemini: "🌐",
  Unknown: "?",
};

export const McpClientList: React.FC<McpClientListProps> = ({ clients, className }) => {
  const formatDuration = (connectedAt: string): string => {
    const now = new Date();
    const connected = new Date(connectedAt);
    const seconds = Math.floor((now.getTime() - connected.getTime()) / 1000);

    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  const formatLastActivity = (lastActivity: string): string => {
    const now = new Date();
    const activity = new Date(lastActivity);
    const seconds = Math.floor((now.getTime() - activity.getTime()) / 1000);

    if (seconds < 5) return "Active";
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return "Idle";
  };

  if (clients.length === 0) {
    return (
      <Card className={cn("p-6 text-center", className)}>
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Monitor className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">Client detection coming soon.</p>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {clients.map((client) => (
        <Card key={client.session_id} className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{clientIcons[client.client_type] || "?"}</span>
              <div>
                <p className="text-sm font-medium">{client.client_type}</p>
                <p className="text-xs text-muted-foreground">Session: {client.session_id.slice(0, 8)}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDuration(client.connected_at)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Activity className="h-3 w-3" />
                {formatLastActivity(client.last_activity)}
              </span>
              <Badge variant={client.status === "active" ? "success" : "secondary"}>
                {client.status}
              </Badge>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};
