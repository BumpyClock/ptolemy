import { useEffect, useState } from "react";
import { Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useToast } from "@/features/shared/hooks/useToast";
import { FeaturesSection } from "@/components/settings/FeaturesSection";
import { APIKeysSection } from "@/components/settings/APIKeysSection";
import { RAGSettings } from "@/components/settings/RAGSettings";
import { CodeExtractionSettings } from "@/components/settings/CodeExtractionSettings";
import { BugReportButton } from "@/components/bug-report/BugReportButton";
import { UpdateBanner } from "@/features/settings/version/components/UpdateBanner";
import { VersionStatusCard } from "@/features/settings/version/components/VersionStatusCard";
import { MigrationStatusCard } from "@/features/settings/migrations/components/MigrationStatusCard";
import { McpConfigSection } from "@/features/mcp/components/McpConfigSection";
import { useMcpConfig, useMcpStatus } from "@/features/mcp/hooks";
import {
  credentialsService,
  RagSettings,
  CodeExtractionSettings as CodeExtractionSettingsType,
} from "@/services/credentialsService";

export const SettingsPage = () => {
  const [ragSettings, setRagSettings] = useState<RagSettings>({
    USE_CONTEXTUAL_EMBEDDINGS: false,
    CONTEXTUAL_EMBEDDINGS_MAX_WORKERS: 3,
    USE_HYBRID_SEARCH: true,
    USE_AGENTIC_RAG: true,
    USE_RERANKING: true,
    USE_LLM_ROUTER: false,
    MODEL_CHOICE: "gpt-4.1-nano",
  });
  const [codeExtractionSettings, setCodeExtractionSettings] =
    useState<CodeExtractionSettingsType>({
      MIN_CODE_BLOCK_LENGTH: 250,
      MAX_CODE_BLOCK_LENGTH: 5000,
      ENABLE_COMPLETE_BLOCK_DETECTION: true,
      ENABLE_LANGUAGE_SPECIFIC_PATTERNS: true,
      ENABLE_PROSE_FILTERING: true,
      MAX_PROSE_RATIO: 0.15,
      MIN_CODE_INDICATORS: 3,
      ENABLE_DIAGRAM_FILTERING: true,
      ENABLE_CONTEXTUAL_LENGTH: true,
      CODE_EXTRACTION_MAX_WORKERS: 3,
      CONTEXT_WINDOW_SIZE: 1000,
      ENABLE_CODE_SUMMARIES: true,
      DEFER_CODE_SUMMARIES: false,
    });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { showToast } = useToast();
  const { data: mcpStatus } = useMcpStatus();
  const { data: mcpConfig } = useMcpConfig();
  const safeMcpStatus = mcpStatus ?? { status: "stopped", uptime: null, logs: [] };

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const ragSettingsData = await credentialsService.getRagSettings();
      setRagSettings(ragSettingsData);
      const codeExtractionSettingsData = await credentialsService.getCodeExtractionSettings();
      setCodeExtractionSettings(codeExtractionSettingsData);
    } catch (err) {
      setError("Failed to load settings");
      console.error(err);
      showToast("Failed to load settings", "error");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center text-sm text-muted-foreground">
        Loading settings...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <UpdateBanner />

      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">Settings</h1>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>General</CardTitle>
          </CardHeader>
          <CardContent>
            <FeaturesSection />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>API Keys</CardTitle>
          </CardHeader>
          <CardContent>
            <APIKeysSection />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>MCP Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <McpConfigSection config={mcpConfig} status={safeMcpStatus} />
        </CardContent>
      </Card>

      <div className="grid gap-8 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>RAG Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <RAGSettings ragSettings={ragSettings} setRagSettings={setRagSettings} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Code Extraction</CardTitle>
          </CardHeader>
          <CardContent>
            <CodeExtractionSettings
              codeExtractionSettings={codeExtractionSettings}
              setCodeExtractionSettings={setCodeExtractionSettings}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Version & Updates</CardTitle>
          </CardHeader>
          <CardContent>
            <VersionStatusCard />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Database Migrations</CardTitle>
          </CardHeader>
          <CardContent>
            <MigrationStatusCard />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bug Reporting</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Found a bug or issue? Report it to help improve Ptolemy.
          </p>
          <BugReportButton variant="secondary">Report Bug</BugReportButton>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>• Bug reports are sent directly to GitHub Issues</p>
            <p>• System context is automatically collected</p>
            <p>• Your privacy is protected - no personal data is sent</p>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}
    </div>
  );
};
