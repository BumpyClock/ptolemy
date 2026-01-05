import { ExternalLink, Loader, Save } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { useToast } from "@/features/shared/hooks/useToast";
import { credentialsService } from "@/services/credentialsService";

interface ProviderStepProps {
  onSaved: () => void;
  onSkip: () => void;
}

export const ProviderStep = ({ onSaved, onSkip }: ProviderStepProps) => {
  const [provider, setProvider] = useState("openai");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  const handleSave = async () => {
    if (!apiKey.trim()) {
      showToast("Please enter an API key", "error");
      return;
    }

    setSaving(true);
    try {
      await credentialsService.createCredential({
        key: "OPENAI_API_KEY",
        value: apiKey,
        is_encrypted: true,
        category: "api_keys",
      });

      await credentialsService.updateCredential({
        key: "LLM_PROVIDER",
        value: "openai",
        is_encrypted: false,
        category: "rag_strategy",
      });

      showToast("API key saved successfully!", "success");
      localStorage.setItem("onboardingDismissed", "true");
      onSaved();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Failed to save API key:", error);

      if (errorMessage.includes("duplicate") || errorMessage.includes("already exists")) {
        showToast(
          "API key already exists. Please update it in Settings if you want to change it.",
          "warning",
        );
      } else if (errorMessage.includes("network") || errorMessage.includes("fetch")) {
        showToast(`Network error while saving API key: ${errorMessage}. Please check your connection.`, "error");
      } else {
        showToast(`Failed to save API key: ${errorMessage}`, "error");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    showToast("You can configure your provider in Settings", "info");
    localStorage.setItem("onboardingDismissed", "true");
    onSkip();
  };

  const handleSaveProviderOnly = async () => {
    try {
      await credentialsService.updateCredential({
        key: "LLM_PROVIDER",
        value: provider,
        is_encrypted: false,
        category: "rag_strategy",
      });
      showToast(`${provider} selected as provider`, "success");
      localStorage.setItem("onboardingDismissed", "true");
      onSaved();
    } catch (error) {
      console.error("Failed to save provider selection:", error);
      showToast("Failed to save provider selection", "error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="provider-select">AI provider</Label>
        <NativeSelect id="provider-select" value={provider} onChange={(e) => setProvider(e.target.value)}>
          <option value="openai">OpenAI</option>
          <option value="google">Google Gemini</option>
          <option value="ollama">Ollama (Local)</option>
        </NativeSelect>
        <p className="text-xs text-muted-foreground">
          {provider === "openai" && "OpenAI provides powerful models like GPT-4. You'll need an API key."}
          {provider === "google" && "Google Gemini offers advanced AI capabilities. Configure it in Settings."}
          {provider === "ollama" && "Ollama runs models locally. Configure it in Settings after setup."}
        </p>
      </div>

      {provider === "openai" ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="openai-key">OpenAI API Key</Label>
            <Input
              id="openai-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
            />
            <p className="text-xs text-muted-foreground">Your API key will be encrypted and stored securely.</p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Get an API key from OpenAI
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button onClick={handleSave} disabled={saving || !apiKey.trim()} className="flex-1 gap-2">
              {saving ? <Loader className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving..." : "Save & Continue"}
            </Button>
            <Button variant="outline" onClick={handleSkip} disabled={saving} className="flex-1">
              Skip for now
            </Button>
          </div>
        </>
      ) : (
        <div className="space-y-4">
          <div className="rounded-md border p-3 text-xs text-muted-foreground">
            {provider === "google" &&
              "Google Gemini configuration will be available in Settings after setup."}
            {provider === "ollama" &&
              "Ollama configuration will be available in Settings after setup. Make sure Ollama is running locally."}
          </div>
          <Button onClick={handleSaveProviderOnly} className="w-full">
            Continue with {provider === "google" ? "Gemini" : "Ollama"}
          </Button>
        </div>
      )}
    </div>
  );
};
