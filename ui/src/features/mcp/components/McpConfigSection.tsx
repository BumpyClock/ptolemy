import { Copy, ExternalLink } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { useToast } from "@/features/shared/hooks";
import { copyToClipboard } from "../../shared/utils/clipboard";
import { Button } from "@/components/ui/Button";
import { Kbd } from "@/components/ui/Kbd";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import type { McpServerConfig, McpServerStatus, SupportedIDE } from "../types";

interface McpConfigSectionProps {
  config?: McpServerConfig;
  status: McpServerStatus;
  className?: string;
}

const ideConfigurations: Record<
  SupportedIDE,
  {
    title: string;
    steps: string[];
    configGenerator: (config: McpServerConfig) => string;
    supportsOneClick?: boolean;
    platformSpecific?: boolean;
  }
> = {
  claudecode: {
    title: "Claude Code Configuration",
    steps: ["Open a terminal and run the following command:", "The connection will be established automatically"],
    configGenerator: (config) =>
      JSON.stringify(
        {
          name: "ptolemy",
          transport: "http",
          url: `http://${config.host}:${config.port}/mcp`,
        },
        null,
        2,
      ),
  },
  gemini: {
    title: "Gemini CLI Configuration",
    steps: [
      "Locate or create the settings file at ~/.gemini/settings.json",
      "Add the configuration shown below to the file",
      "Launch Gemini CLI in your terminal",
      "Test the connection by typing /mcp to list available tools",
    ],
    configGenerator: (config) =>
      JSON.stringify(
        {
          mcpServers: {
            ptolemy: {
              httpUrl: `http://${config.host}:${config.port}/mcp`,
            },
          },
        },
        null,
        2,
      ),
  },
  codex: {
    title: "Codex Configuration",
    steps: [
      "Step 1: Install mcp-remote globally: npm install -g mcp-remote",
      "Step 2: Add configuration to ~/.codex/config.toml",
      "Step 3: Find your exact mcp-remote path by running: npm root -g",
      "Step 4: Replace the path in the configuration with your actual path + /mcp-remote/dist/proxy.js",
    ],
    configGenerator: (config) => {
      const isWindows = navigator.platform.toLowerCase().includes("win");

      if (isWindows) {
        return `[mcp_servers.ptolemy]
command = 'node'
args = [
    'C:/Users/YOUR_USERNAME/AppData/Roaming/npm/node_modules/mcp-remote/dist/proxy.js',
    'http://${config.host}:${config.port}/mcp'
]
env = {
    APPDATA = 'C:\\\\Users\\\\YOUR_USERNAME\\\\AppData\\\\Roaming',
    LOCALAPPDATA = 'C:\\\\Users\\\\YOUR_USERNAME\\\\AppData\\\\Local',
    SystemRoot = 'C:\\\\WINDOWS',
    COMSPEC = 'C:\\\\WINDOWS\\\\system32\\\\cmd.exe'
}`;
      }
      return `[mcp_servers.ptolemy]
command = 'node'
args = [
    '/usr/local/lib/node_modules/mcp-remote/dist/proxy.js',
    'http://${config.host}:${config.port}/mcp'
]
env = { }`;
    },
    platformSpecific: true,
  },
  cursor: {
    title: "Cursor Configuration",
    steps: [
      "Option A: Use the one-click install button below (recommended)",
      "Option B: Manually edit ~/.cursor/mcp.json",
      "Add the configuration shown below",
      "Restart Cursor for changes to take effect",
    ],
    configGenerator: (config) =>
      JSON.stringify(
        {
          mcpServers: {
            ptolemy: {
              url: `http://${config.host}:${config.port}/mcp`,
            },
          },
        },
        null,
        2,
      ),
    supportsOneClick: true,
  },
  windsurf: {
    title: "Windsurf Configuration",
    steps: [
      'Open Windsurf and click the "MCP servers" button (hammer icon)',
      'Click "Configure" and then "View raw config"',
      "Add the configuration shown below to the mcpServers object",
      'Click "Refresh" to connect to the server',
    ],
    configGenerator: (config) =>
      JSON.stringify(
        {
          mcpServers: {
            ptolemy: {
              serverUrl: `http://${config.host}:${config.port}/mcp`,
            },
          },
        },
        null,
        2,
      ),
  },
  cline: {
    title: "Cline Configuration",
    steps: [
      "Open VS Code settings (Cmd/Ctrl + ,)",
      'Search for "cline.mcpServers"',
      'Click "Edit in settings.json"',
      "Add the configuration shown below",
      "Restart VS Code for changes to take effect",
    ],
    configGenerator: (config) =>
      JSON.stringify(
        {
          mcpServers: {
            ptolemy: {
              command: "npx",
              args: ["mcp-remote", `http://${config.host}:${config.port}/mcp`, "--allow-http"],
            },
          },
        },
        null,
        2,
      ),
  },
  kiro: {
    title: "Kiro Configuration",
    steps: [
      "Open Kiro settings",
      "Navigate to MCP Servers section",
      "Add the configuration shown below",
      "Save and restart Kiro",
    ],
    configGenerator: (config) =>
      JSON.stringify(
        {
          mcpServers: {
            ptolemy: {
              command: "npx",
              args: ["mcp-remote", `http://${config.host}:${config.port}/mcp`, "--allow-http"],
            },
          },
        },
        null,
        2,
      ),
  },
};

export const McpConfigSection: React.FC<McpConfigSectionProps> = ({ config, status, className }) => {
  const [selectedIDE, setSelectedIDE] = useState<SupportedIDE>("claudecode");
  const { showToast } = useToast();

  if (status.status !== "running" || !config) {
    return (
      <div className={className}>
        <div className="rounded-lg border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
          Start the MCP server to see configuration options.
        </div>
      </div>
    );
  }

  const handleCopyConfig = async () => {
    const configText = ideConfigurations[selectedIDE].configGenerator(config);
    const result = await copyToClipboard(configText);

    if (result.success) {
      showToast("Configuration copied to clipboard", "success");
    } else {
      console.error("Failed to copy config:", result.error);
      showToast("Failed to copy configuration", "error");
    }
  };

  const handleCursorOneClick = () => {
    const httpConfig = { url: `http://${config.host}:${config.port}/mcp` };
    const configString = JSON.stringify(httpConfig);
    const base64Config = btoa(configString);
    const deeplink = `cursor://anysphere.cursor-deeplink/mcp/install?name=ptolemy&config=${base64Config}`;
    window.location.href = deeplink;
    showToast("Opening Cursor with Ptolemy MCP configuration...", "info");
  };

  const handleClaudeCodeCommand = async () => {
    const command = `claude mcp add --transport http ptolemy http://${config.host}:${config.port}/mcp`;
    const result = await copyToClipboard(command);

    if (result.success) {
      showToast("Command copied to clipboard", "success");
    } else {
      console.error("Failed to copy command:", result.error);
      showToast("Failed to copy command", "error");
    }
  };

  const selectedConfig = ideConfigurations[selectedIDE];
  const configText = selectedConfig.configGenerator(config);

  return (
    <div className={className}>
      <div className="mb-4 rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Note:</span> Ptolemy works with any application that supports
        MCP. Below are instructions for common tools, but these steps can be adapted for any MCP-compatible client.
      </div>

      <Tabs value={selectedIDE} onValueChange={(value) => setSelectedIDE(value as SupportedIDE)}>
        <TabsList className="grid w-full grid-cols-3 gap-1 lg:grid-cols-7">
          <TabsTrigger value="claudecode">Claude Code</TabsTrigger>
          <TabsTrigger value="gemini">Gemini</TabsTrigger>
          <TabsTrigger value="codex">Codex</TabsTrigger>
          <TabsTrigger value="cursor">Cursor</TabsTrigger>
          <TabsTrigger value="windsurf">Windsurf</TabsTrigger>
          <TabsTrigger value="cline">Cline</TabsTrigger>
          <TabsTrigger value="kiro">Kiro</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedIDE} className="mt-6 space-y-4">
          <div>
            <h4 className="text-lg font-semibold">{selectedConfig.title}</h4>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
              {selectedConfig.steps.map((step) => {
                if (selectedIDE === "codex" && step.includes("npm install -g mcp-remote")) {
                  const parts = step.split("npm install -g mcp-remote");
                  return (
                    <li key={step}>
                      {parts[0]}
                      <Kbd>npm install -g mcp-remote</Kbd>
                      {parts[1]}
                    </li>
                  );
                }
                return <li key={step}>{step}</li>;
              })}
            </ol>
          </div>

          {selectedIDE === "claudecode" && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 p-4">
              <code className="text-xs text-muted-foreground">
                claude mcp add --transport http ptolemy http://{config.host}:{config.port}/mcp
              </code>
              <Button variant="outline" size="sm" onClick={handleClaudeCodeCommand}>
                <Copy className="mr-1 h-3 w-3" />
                Copy
              </Button>
            </div>
          )}

          <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Configuration</span>
              <Button variant="outline" size="sm" onClick={handleCopyConfig}>
                <Copy className="mr-1 h-3 w-3" />
                Copy
              </Button>
            </div>
            <pre className="max-h-[320px] overflow-auto rounded-md border bg-muted/30 p-3 text-xs">
              <code>{configText}</code>
            </pre>
          </div>

          {selectedIDE === "cursor" && selectedConfig.supportsOneClick && (
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={handleCursorOneClick}>
                <ExternalLink className="mr-2 h-4 w-4" />
                One-click install for Cursor
              </Button>
              <span className="text-xs text-muted-foreground">Opens Cursor with configuration</span>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
