import { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, Bug, RefreshCw } from "lucide-react";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { BugReportModal } from "./BugReportModal";
import { bugReportService, BugContext } from "../../services/bugReportService";

interface Props {
  children: ReactNode;
  fallback?: (error: Error, errorInfo: ErrorInfo) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showBugReport: boolean;
  bugContext: BugContext | null;
}

export class ErrorBoundaryWithBugReport extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showBugReport: false,
      bugContext: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });

    // Collect bug context automatically when error occurs
    this.collectBugContext(error);
  }

  private async collectBugContext(error: Error) {
    try {
      const context = await bugReportService.collectBugContext(error);
      this.setState({ bugContext: context });
    } catch (contextError) {
      console.error("Failed to collect bug context:", contextError);
    }
  }

  private handleReportBug = () => {
    this.setState({ showBugReport: true });
  };

  private handleCloseBugReport = () => {
    this.setState({ showBugReport: false });
  };

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showBugReport: false,
      bugContext: null,
    });
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.state.errorInfo!);
      }

      // Default error UI
      return (
        <>
          <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <Card className="max-w-lg w-full">
              <div className="p-6 text-center">
                {/* Error Icon */}
                <div className="w-16 h-16 mx-auto mb-4 bg-destructive/10 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-8 h-8 text-destructive" />
                </div>

                {/* Error Title */}
                <h1 className="text-xl font-bold text-foreground mb-2">
                  Something went wrong
                </h1>

                {/* Error Message */}
                <p className="text-muted-foreground mb-4">
                  {this.state.error.message}
                </p>

                {/* Error Details (collapsible) */}
                <details className="text-left mb-6">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground text-sm">
                    Technical details
                  </summary>
                  <div className="mt-2 p-3 bg-muted rounded text-xs font-mono overflow-auto max-h-32">
                    <div className="mb-2">
                      <strong>Error:</strong> {this.state.error.name}
                    </div>
                    <div className="mb-2">
                      <strong>Message:</strong> {this.state.error.message}
                    </div>
                    {this.state.error.stack && (
                      <div>
                        <strong>Stack:</strong>
                        <pre className="mt-1 whitespace-pre-wrap">
                          {this.state.error.stack}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button onClick={this.handleRetry} variant="ghost">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Try Again
                  </Button>

                  <Button onClick={this.handleReload} variant="ghost">
                    Reload Page
                  </Button>

                  <Button
                    onClick={this.handleReportBug}
                    variant="destructive"
                    disabled={!this.state.bugContext}
                  >
                    <Bug className="w-4 h-4 mr-2" />
                    Report Bug
                  </Button>
                </div>

                {/* Help Text */}
                <p className="text-xs text-muted-foreground mt-6">
                  If this keeps happening, please report the bug so we can fix
                  it.
                </p>
              </div>
            </Card>
          </div>

          {/* Bug Report Modal */}
          {this.state.bugContext && (
            <BugReportModal
              isOpen={this.state.showBugReport}
              onClose={this.handleCloseBugReport}
              context={this.state.bugContext}
            />
          )}
        </>
      );
    }

    return this.props.children;
  }
}
