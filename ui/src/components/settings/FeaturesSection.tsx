import { useState, useEffect } from "react";
import { Flame, Monitor, Moon, Sun } from "lucide-react";
import { Switch } from "@/components/ui/Switch";
import { useTheme } from "../../contexts/ThemeContext";
import { credentialsService } from "../../services/credentialsService";
import { useToast } from "../../features/shared/hooks/useToast";
import { serverHealthService } from "../../services/serverHealthService";

export const FeaturesSection = () => {
  const {
    theme,
    setTheme
  } = useTheme();
  const { showToast } = useToast();
  const isDarkMode = theme === 'dark';

  const [logfireEnabled, setLogfireEnabled] = useState(false);
  const [disconnectScreenEnabled, setDisconnectScreenEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  // Load settings on mount and sync with context
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      
      const [logfireResponse, disconnectScreenRes] = await Promise.all([
        credentialsService.getCredential("LOGFIRE_ENABLED").catch(() => ({ value: undefined })),
        credentialsService.getCredential("DISCONNECT_SCREEN_ENABLED").catch(() => ({ value: "true" })),
      ]);
      
      // Set Logfire setting
      if (logfireResponse.value !== undefined) {
        setLogfireEnabled(logfireResponse.value === "true");
      } else {
        setLogfireEnabled(false);
      }

      setDisconnectScreenEnabled(disconnectScreenRes.value === "true");
    } catch (error) {
      console.error('Failed to load settings:', error);
      // Default values on error
      setLogfireEnabled(false);
      setDisconnectScreenEnabled(true);
    } finally {
      setLoading(false);
    }
  };

  const handleLogfireToggle = async (checked: boolean) => {
    // Prevent duplicate calls while one is already in progress
    if (loading) return;
    
    try {
      setLoading(true);
      // Update local state immediately for responsive UI
      setLogfireEnabled(checked);

      // Save to backend
      await credentialsService.createCredential({
        key: "LOGFIRE_ENABLED",
        value: checked.toString(),
        is_encrypted: false,
        category: "monitoring",
        description: "Enable or disable Pydantic Logfire logging and observability",
      });

      showToast(checked ? "Logfire Enabled Successfully!" : "Logfire Now Disabled", checked ? "success" : "warning");
    } catch (error) {
      console.error('Failed to update logfire setting:', error);
      // Revert local state on error
      setLogfireEnabled(!checked);
      showToast('Failed to update Logfire setting', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleThemeToggle = (checked: boolean) => {
    setTheme(checked ? 'dark' : 'light');
  };

  const handleDisconnectScreenToggle = async (checked: boolean) => {
    if (loading) return;

    try {
      setLoading(true);
      setDisconnectScreenEnabled(checked);

      await serverHealthService.updateSettings({ enabled: checked });

      showToast(checked ? "Disconnect Screen Enabled" : "Disconnect Screen Disabled", checked ? "success" : "warning");
    } catch (error) {
      console.error('Failed to update disconnect screen setting:', error);
      setDisconnectScreenEnabled(!checked);
      showToast('Failed to update disconnect screen setting', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <p className="text-sm font-medium">Dark mode</p>
            <p className="text-xs text-muted-foreground">Switch between light and dark themes</p>
          </div>
          <div className="flex items-center gap-2">
            {isDarkMode ? <Moon className="h-4 w-4 text-muted-foreground" /> : <Sun className="h-4 w-4 text-muted-foreground" />}
            <Switch checked={isDarkMode} onCheckedChange={handleThemeToggle} />
          </div>
        </div>

          {/* COMMENTED OUT FOR FUTURE RELEASE - AG-UI Library Toggle */}
          {/*
          <div className="flex items-center gap-4 p-4 rounded-xl bg-muted border border-border">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground">
                AG-UI Library
              </p>
              <p className="text-sm text-muted-foreground">
                Enable component library functionality
              </p>
            </div>
            <div className="flex-shrink-0">
              <Toggle checked={agUILibraryEnabled} onCheckedChange={setAgUILibraryEnabled} accentColor="pink" icon={<Layout className="w-5 h-5" />} />
            </div>
          </div>
          */}

          {/* COMMENTED OUT FOR FUTURE RELEASE - Agents Toggle */}
          {/*
          <div className="flex items-center gap-4 p-4 rounded-xl bg-muted border border-border">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground">
                Agents
              </p>
              <p className="text-sm text-muted-foreground">
                Enable AI agents for automated tasks
              </p>
            </div>
            <div className="flex-shrink-0">
              <Toggle checked={agentsEnabled} onCheckedChange={setAgentsEnabled} accentColor="green" icon={<Bot className="w-5 h-5" />} />
            </div>
          </div>
          */}

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <p className="text-sm font-medium">Pydantic Logfire</p>
            <p className="text-xs text-muted-foreground">Structured logging and observability</p>
          </div>
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-muted-foreground" />
            <Switch checked={logfireEnabled} onCheckedChange={handleLogfireToggle} disabled={loading} />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <p className="text-sm font-medium">Disconnect screen</p>
            <p className="text-xs text-muted-foreground">Show a banner when the server disconnects</p>
          </div>
          <div className="flex items-center gap-2">
            <Monitor className="h-4 w-4 text-muted-foreground" />
            <Switch checked={disconnectScreenEnabled} onCheckedChange={handleDisconnectScreenToggle} disabled={loading} />
          </div>
        </div>
      </div>
    </>
  );
};
