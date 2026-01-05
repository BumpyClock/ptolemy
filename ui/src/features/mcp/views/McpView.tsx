import { Server } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { McpClientList, McpConfigSection, McpStatusBar } from "../components";
import { useMcpClients, useMcpConfig, useMcpSessionInfo, useMcpStatus } from "../hooks";

export const McpView: React.FC = () => {
  const { data: status, isLoading: statusLoading } = useMcpStatus();
  const { data: config } = useMcpConfig();
  const { data: clients = [] } = useMcpClients();
  const { data: sessionInfo } = useMcpSessionInfo();

  if (statusLoading || !status) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Server className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">MCP Status</h1>
      </div>

      <div>
        <h2 className="text-lg font-semibold">Status</h2>
        <div className="mt-3 rounded-lg border bg-muted/40 p-4">
          <McpStatusBar status={status} sessionInfo={sessionInfo} config={config} />
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold">Connected Clients</h2>
        <div className="mt-3 rounded-lg border bg-muted/40 p-4">
          <McpClientList clients={clients} />
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold">IDE Configuration</h2>
        <div className="mt-3">
          <McpConfigSection config={config} status={status} />
        </div>
      </div>
    </div>
  );
};
