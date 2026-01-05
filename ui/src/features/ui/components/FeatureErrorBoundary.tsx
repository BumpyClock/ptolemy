import { AlertTriangle, RefreshCw } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface Props {
  children: ReactNode;
  featureName: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class FeatureErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log detailed error information for debugging in dev/test
    if (import.meta.env.DEV || import.meta.env.MODE === "test") {
      console.error(`Feature Error in ${this.props.featureName}:`, {
        error,
        errorInfo,
        componentStack: errorInfo.componentStack,
        errorMessage: error.message,
        errorStack: error.stack,
        timestamp: new Date().toISOString(),
      });
    }

    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo } = this.state;
      const isDevelopment = import.meta.env.DEV;

      return (
        <div className="min-h-[400px] flex items-center justify-center p-8">
          <div className="max-w-2xl w-full">
            <div className="flex items-start gap-4" role="alert" aria-live="assertive" aria-atomic="true">
              <div
                className={cn(
                  "p-3 rounded-lg",
                  "bg-destructive/10",
                  "border border-destructive/20",
                )}
              >
                <AlertTriangle
                  className="w-6 h-6 text-destructive"
                  aria-hidden="true"
                  focusable="false"
                />
              </div>

              <div className="flex-1 rounded-lg border bg-card p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-foreground mb-2">
                  Feature Error: {this.props.featureName}
                </h2>

                <p className="text-muted-foreground mb-4">
                  An error occurred in this feature. The error has been logged for investigation.
                </p>

                {/* Show detailed error in development */}
                {isDevelopment && error && (
                  <div
                    className={cn(
                      "mb-4 p-4 rounded-lg overflow-auto max-h-[300px]",
                      "bg-muted",
                      "border border-border",
                      "font-mono text-xs",
                    )}
                  >
                    <div className="text-destructive font-semibold mb-2">{error.toString()}</div>
                    {error.stack && (
                      <pre className="text-muted-foreground whitespace-pre-wrap">{error.stack}</pre>
                    )}
                    {errorInfo?.componentStack && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <div className="text-muted-foreground font-semibold mb-2">Component Stack:</div>
                        <pre className="text-muted-foreground whitespace-pre-wrap">
                          {errorInfo.componentStack}
                        </pre>
                      </div>
                    )}
                  </div>
                )}

                <Button onClick={this.handleReset} variant="default" size="sm" className="gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
