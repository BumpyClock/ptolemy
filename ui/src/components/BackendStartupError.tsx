import React from 'react';
import { AlertCircle, Terminal, RefreshCw } from 'lucide-react';

export const BackendStartupError: React.FC = () => {
  const handleRetry = () => {
    // Reload the page to retry
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-black/90 backdrop-blur-sm flex items-center justify-center p-8">
      <div className="max-w-2xl w-full">
        <div className="bg-background border border-border rounded-lg p-8 shadow-lg">
          <div className="flex items-start gap-4">
            <AlertCircle className="w-8 h-8 text-destructive flex-shrink-0 mt-1" />
            <div className="space-y-4 flex-1">
              <h2 className="text-2xl font-bold text-foreground">
                Backend Service Startup Failure
              </h2>
              
              <p className="text-muted-foreground">
                The Ptolemy backend service failed to start. This is typically due to a configuration issue.
              </p>

              <div className="bg-muted rounded-lg p-4 border border-border">
                <div className="flex items-center gap-2 mb-3 text-foreground">
                  <Terminal className="w-5 h-5" />
                  <span className="font-semibold">Check Docker Logs</span>
                </div>
                <p className="text-muted-foreground font-mono text-sm mb-3">
                  Check the <span className="text-foreground font-bold">Ptolemy API server</span> container logs in Docker Desktop for detailed error information.
                </p>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <p>1. Open Docker Desktop</p>
                  <p>2. Go to Containers tab</p>
                  <p>3. Look for the Ptolemy server container (typically named <span className="text-foreground font-semibold">ptolemy-server</span> or similar)</p>
                  <p>4. View the logs for the specific error message</p>
                </div>
              </div>

              <div className="bg-muted border border-border rounded-lg p-3">
                <p className="text-foreground text-sm">
                  <strong>Common issues:</strong>
                </p>
                <ul className="text-muted-foreground text-sm mt-1 space-y-1 list-disc list-inside">
                  <li>Using an ANON key instead of SERVICE key in your .env file</li>
                  <li>Database not set up - run <code className="bg-background px-1 rounded">migration/complete_setup.sql</code> in Supabase SQL Editor</li>
                </ul>
              </div>

              <div className="pt-4 border-t border-border">
                <p className="text-muted-foreground text-sm">
                  After fixing the issue in your .env file, recreate the Docker containers:
                </p>
                <code className="block mt-2 p-2 bg-muted rounded text-foreground font-mono text-sm">
                  docker compose down && docker compose up --build -d
                </code>
                <div className="text-muted-foreground text-xs mt-2">
                  <p>Note:</p>
                  <p>• Use 'down' and 'up' (not 'restart') so new env vars are picked up.</p>
                  <p>• If you originally started with a specific profile (backend, frontend, or full),</p>
                  <p>&nbsp;&nbsp;run the same profile again:</p>
                  <br />
                  <code className="bg-background px-1 rounded">docker compose --profile full up --build -d</code>
                </div>
              </div>

              <div className="flex justify-center pt-4">
                <button
                  onClick={handleRetry}
                  className="flex items-center gap-2 px-4 py-2 bg-destructive/10 hover:bg-destructive/20 border border-destructive/30 rounded-lg text-destructive transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retry Connection
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
