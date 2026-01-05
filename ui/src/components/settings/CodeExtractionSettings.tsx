import { useState } from "react";
import { Loader, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { useToast } from "@/features/shared/hooks/useToast";
import { credentialsService } from "@/services/credentialsService";

interface CodeExtractionSettingsProps {
  codeExtractionSettings: {
    MIN_CODE_BLOCK_LENGTH: number;
    MAX_CODE_BLOCK_LENGTH: number;
    ENABLE_COMPLETE_BLOCK_DETECTION: boolean;
    ENABLE_LANGUAGE_SPECIFIC_PATTERNS: boolean;
    ENABLE_PROSE_FILTERING: boolean;
    MAX_PROSE_RATIO: number;
    MIN_CODE_INDICATORS: number;
    ENABLE_DIAGRAM_FILTERING: boolean;
    ENABLE_CONTEXTUAL_LENGTH: boolean;
    CODE_EXTRACTION_MAX_WORKERS: number;
    CONTEXT_WINDOW_SIZE: number;
    ENABLE_CODE_SUMMARIES: boolean;
    DEFER_CODE_SUMMARIES: boolean;
  };
  setCodeExtractionSettings: (settings: any) => void;
}

const CheckboxRow = ({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) => (
  <div className="flex items-start gap-3">
    <Checkbox id={id} checked={checked} onCheckedChange={(value) => onChange(Boolean(value))} />
    <div>
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
      </Label>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  </div>
);

export const CodeExtractionSettings = ({ codeExtractionSettings, setCodeExtractionSettings }: CodeExtractionSettingsProps) => {
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  const handleSave = async () => {
    try {
      setSaving(true);
      await credentialsService.updateCodeExtractionSettings(codeExtractionSettings);
      showToast("Code extraction settings saved successfully!", "success");
    } catch (err) {
      console.error("Failed to save code extraction settings:", err);
      showToast("Failed to save settings", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Configure how code blocks are extracted from crawled documents.
      </p>

      <div className="flex justify-end">
        <Button variant="outline" onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving..." : "Save settings"}
        </Button>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold">Code block length</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Minimum length (chars)</Label>
            <Input
              type="number"
              value={codeExtractionSettings.MIN_CODE_BLOCK_LENGTH}
              onChange={(e) =>
                setCodeExtractionSettings({
                  ...codeExtractionSettings,
                  MIN_CODE_BLOCK_LENGTH: parseInt(e.target.value, 10) || 250,
                })
              }
              min="50"
              max="2000"
            />
          </div>
          <div className="space-y-2">
            <Label>Maximum length (chars)</Label>
            <Input
              type="number"
              value={codeExtractionSettings.MAX_CODE_BLOCK_LENGTH}
              onChange={(e) =>
                setCodeExtractionSettings({
                  ...codeExtractionSettings,
                  MAX_CODE_BLOCK_LENGTH: parseInt(e.target.value, 10) || 5000,
                })
              }
              min="1000"
              max="20000"
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold">Detection features</h3>
        <div className="space-y-3">
          <CheckboxRow
            id="completeBlockDetection"
            checked={codeExtractionSettings.ENABLE_COMPLETE_BLOCK_DETECTION}
            onChange={(checked) =>
              setCodeExtractionSettings({ ...codeExtractionSettings, ENABLE_COMPLETE_BLOCK_DETECTION: checked })
            }
            label="Complete block detection"
            description="Extend code blocks to natural boundaries (closing braces, etc.)"
          />
          <CheckboxRow
            id="languagePatterns"
            checked={codeExtractionSettings.ENABLE_LANGUAGE_SPECIFIC_PATTERNS}
            onChange={(checked) =>
              setCodeExtractionSettings({ ...codeExtractionSettings, ENABLE_LANGUAGE_SPECIFIC_PATTERNS: checked })
            }
            label="Language-specific patterns"
            description="Use specialized patterns for TypeScript, Python, Java, etc."
          />
          <CheckboxRow
            id="contextualLength"
            checked={codeExtractionSettings.ENABLE_CONTEXTUAL_LENGTH}
            onChange={(checked) => setCodeExtractionSettings({ ...codeExtractionSettings, ENABLE_CONTEXTUAL_LENGTH: checked })}
            label="Contextual length adjustment"
            description="Adjust minimum length based on context (example, snippet, implementation)"
          />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold">Content filtering</h3>
        <div className="space-y-3">
          <CheckboxRow
            id="proseFiltering"
            checked={codeExtractionSettings.ENABLE_PROSE_FILTERING}
            onChange={(checked) => setCodeExtractionSettings({ ...codeExtractionSettings, ENABLE_PROSE_FILTERING: checked })}
            label="Filter prose content"
            description="Remove documentation text mistakenly wrapped in code blocks"
          />
          <CheckboxRow
            id="diagramFiltering"
            checked={codeExtractionSettings.ENABLE_DIAGRAM_FILTERING}
            onChange={(checked) => setCodeExtractionSettings({ ...codeExtractionSettings, ENABLE_DIAGRAM_FILTERING: checked })}
            label="Filter diagram languages"
            description="Exclude Mermaid, PlantUML, and other diagram formats"
          />
          <CheckboxRow
            id="codeSummaries"
            checked={codeExtractionSettings.ENABLE_CODE_SUMMARIES}
            onChange={(checked) => setCodeExtractionSettings({ ...codeExtractionSettings, ENABLE_CODE_SUMMARIES: checked })}
            label="Generate code summaries"
            description="Use AI to create summaries and names for code examples"
          />
          <CheckboxRow
            id="deferCodeSummaries"
            checked={codeExtractionSettings.DEFER_CODE_SUMMARIES}
            onChange={(checked) => setCodeExtractionSettings({ ...codeExtractionSettings, DEFER_CODE_SUMMARIES: checked })}
            label="Defer code summaries"
            description="Store code examples immediately and generate summaries after ingestion"
          />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold">Advanced settings</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Max prose ratio</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={codeExtractionSettings.MAX_PROSE_RATIO}
              onChange={(e) =>
                setCodeExtractionSettings({
                  ...codeExtractionSettings,
                  MAX_PROSE_RATIO: parseFloat(e.target.value) || 0.15,
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Min code indicators</Label>
            <Input
              type="number"
              min="1"
              max="10"
              value={codeExtractionSettings.MIN_CODE_INDICATORS}
              onChange={(e) =>
                setCodeExtractionSettings({
                  ...codeExtractionSettings,
                  MIN_CODE_INDICATORS: parseInt(e.target.value, 10) || 3,
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Context window size</Label>
            <Input
              type="number"
              min="100"
              max="2000"
              value={codeExtractionSettings.CONTEXT_WINDOW_SIZE}
              onChange={(e) =>
                setCodeExtractionSettings({
                  ...codeExtractionSettings,
                  CONTEXT_WINDOW_SIZE: parseInt(e.target.value, 10) || 1000,
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Max workers</Label>
            <Input
              type="number"
              min="1"
              max="10"
              value={codeExtractionSettings.CODE_EXTRACTION_MAX_WORKERS}
              onChange={(e) =>
                setCodeExtractionSettings({
                  ...codeExtractionSettings,
                  CODE_EXTRACTION_MAX_WORKERS: parseInt(e.target.value, 10) || 3,
                })
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
};
