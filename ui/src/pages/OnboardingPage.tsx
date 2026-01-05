import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check, Key, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { ProviderStep } from "@/components/onboarding/ProviderStep";

export const OnboardingPage = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const navigate = useNavigate();

  const handleProviderSaved = () => {
    setCurrentStep(3);
  };

  const handleProviderSkip = () => {
    navigate("/settings");
  };

  const handleComplete = () => {
    localStorage.setItem("onboardingDismissed", "true");
    navigate("/");
  };

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <div className="flex items-center justify-center gap-2">
          {[1, 2, 3].map((step) => (
            <div
              key={step}
              className={`h-2 w-16 rounded-full ${step <= currentStep ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>

        {currentStep === 1 && (
          <Card>
            <CardContent className="space-y-6 p-10 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Sparkles className="h-8 w-8" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold">Welcome to Ptolemy</h1>
                <p className="text-sm text-muted-foreground">
                  Set up your AI provider to enable intelligent knowledge retrieval and code assistance.
                </p>
              </div>
              <Button onClick={() => setCurrentStep(2)} className="gap-2">
                Get started
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {currentStep === 2 && (
          <Card>
            <CardContent className="space-y-6 p-10">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <Key className="h-5 w-5" />
                </div>
                <h2 className="text-xl font-semibold">Configure AI Provider</h2>
              </div>
              <ProviderStep onSaved={handleProviderSaved} onSkip={handleProviderSkip} />
            </CardContent>
          </Card>
        )}

        {currentStep === 3 && (
          <Card>
            <CardContent className="space-y-6 p-10 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Check className="h-8 w-8" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold">All set</h1>
                <p className="text-sm text-muted-foreground">
                  You are ready to start using Ptolemy. Add knowledge sources to get started.
                </p>
              </div>
              <Button onClick={handleComplete}>Start using Ptolemy</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
