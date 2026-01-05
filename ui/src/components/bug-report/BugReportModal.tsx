import { useState } from "react";
import { Bug, Loader, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { SelectField } from "@/components/ui/SelectField";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/features/shared/hooks/useToast";
import { bugReportService, BugContext, BugReportData } from "@/services/bugReportService";
import { copyToClipboard } from "@/features/shared/utils/clipboard";

interface BugReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  context: BugContext;
}

export const BugReportModal: React.FC<BugReportModalProps> = ({ isOpen, onClose, context }) => {
  const [report, setReport] = useState<Omit<BugReportData, "context">>({
    title: `Bug: ${context.error.name}: ${context.error.message}`,
    description: "",
    stepsToReproduce: "",
    expectedBehavior: "",
    actualBehavior: context.error.message,
    severity: "medium",
    component: "not-sure",
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!report.description.trim()) {
      showToast("Please provide a description of what you were trying to do", "error");
      return;
    }

    setSubmitting(true);
    try {
      const bugReportData: BugReportData = { ...report, context };
      const result = await bugReportService.submitBugReport(bugReportData);

      if (result.success) {
        setSubmitted(true);

        if (result.issueNumber) {
          showToast(`Bug report created! Issue #${result.issueNumber}.`, "success", 8000);
          if (result.issueUrl) window.open(result.issueUrl, "_blank");
        } else {
          showToast("Opening GitHub to submit your bug report...", "success", 5000);
          if (result.issueUrl) {
            const newWindow = window.open(result.issueUrl, "_blank", "noopener,noreferrer");
            if (!newWindow) {
              showToast("Popup blocked! Please allow popups or click the link below.", "warning", 8000);
            }
          }
        }
      } else {
        const formattedReport = bugReportService.formatReportForClipboard(bugReportData);
        const clipboardResult = await copyToClipboard(formattedReport);
        if (clipboardResult.success) {
          showToast(
            "Failed to create GitHub issue, but bug report was copied to clipboard. Please paste it in a new GitHub issue.",
            "warning",
            10000,
          );
        } else {
          showToast("Failed to create GitHub issue and could not copy to clipboard. Please report manually.", "error", 10000);
        }
      }
    } catch (error) {
      console.error("Bug report submission failed:", error);
      showToast("Failed to submit bug report. Please try again or report manually.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyToClipboard = async () => {
    const bugReportData: BugReportData = { ...report, context };
    const formattedReport = bugReportService.formatReportForClipboard(bugReportData);
    const result = await copyToClipboard(formattedReport);
    if (result.success) {
      showToast("Bug report copied to clipboard", "success");
    } else {
      showToast("Failed to copy to clipboard", "error");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5 text-destructive" />
            Report Bug
          </DialogTitle>
        </DialogHeader>

        {submitted ? (
          <div className="space-y-4 text-sm">
            <p>Thank you for helping improve Ptolemy. Maintainers will review your report.</p>
            <Button onClick={onClose}>Close</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
              <strong>Error:</strong> {context.error.name}: {context.error.message}
            </div>

            <div className="space-y-2">
              <Label htmlFor="bug-title">Title</Label>
              <Input
                id="bug-title"
                value={report.title}
                onChange={(e) => setReport((r) => ({ ...r, title: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bug-description">Description</Label>
              <Textarea
                id="bug-description"
                value={report.description}
                onChange={(e) => setReport((r) => ({ ...r, description: e.target.value }))}
                placeholder="What were you trying to do?"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <SelectField
                label="Severity"
                value={report.severity}
                onChange={(e) => setReport((r) => ({ ...r, severity: e.target.value as any }))}
                options={[
                  { value: "low", label: "Low" },
                  { value: "medium", label: "Medium" },
                  { value: "high", label: "High" },
                  { value: "critical", label: "Critical" },
                ]}
              />
              <SelectField
                label="Component"
                value={report.component}
                onChange={(e) => setReport((r) => ({ ...r, component: e.target.value }))}
                options={[
                  { value: "not-sure", label: "Not sure" },
                  { value: "knowledge", label: "Knowledge base" },
                  { value: "mcp", label: "MCP" },
                  { value: "settings", label: "Settings" },
                ]}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bug-steps">Steps to reproduce</Label>
              <Textarea
                id="bug-steps"
                value={report.stepsToReproduce}
                onChange={(e) => setReport((r) => ({ ...r, stepsToReproduce: e.target.value }))}
                placeholder="1. ..."
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bug-expected">Expected behavior</Label>
                <Textarea
                  id="bug-expected"
                  value={report.expectedBehavior}
                  onChange={(e) => setReport((r) => ({ ...r, expectedBehavior: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bug-actual">Actual behavior</Label>
                <Textarea
                  id="bug-actual"
                  value={report.actualBehavior}
                  onChange={(e) => setReport((r) => ({ ...r, actualBehavior: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={submitting} className="gap-2">
                {submitting ? <Loader className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {submitting ? "Submitting..." : "Submit report"}
              </Button>
              <Button type="button" variant="outline" onClick={handleCopyToClipboard}>
                Copy to clipboard
              </Button>
              <Button type="button" variant="ghost" onClick={onClose}>
                Close
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
