import React from "react";
import { CheckCircle, Copy, Database, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { Separator } from "@/components/ui/Separator";
import { useToast } from "@/features/shared/hooks/useToast";
import { copyToClipboard } from "@/features/shared/utils/clipboard";
import type { PendingMigration } from "../types";

interface PendingMigrationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  migrations: PendingMigration[];
  onMigrationsApplied: () => void;
}

export function PendingMigrationsModal({
  isOpen,
  onClose,
  migrations,
  onMigrationsApplied,
}: PendingMigrationsModalProps) {
  const { showToast } = useToast();
  const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);
  const [expandedIndex, setExpandedIndex] = React.useState<number | null>(null);

  const handleCopy = async (sql: string, index: number) => {
    const result = await copyToClipboard(sql);
    if (result.success) {
      setCopiedIndex(index);
      showToast("SQL copied to clipboard", "success");
      setTimeout(() => setCopiedIndex(null), 2000);
    } else {
      showToast("Failed to copy SQL", "error");
    }
  };

  const handleCopyAll = async () => {
    const allSql = migrations.map((m) => `-- ${m.name}\n${m.sql_content}`).join("\n\n");
    const result = await copyToClipboard(allSql);
    if (result.success) {
      showToast("All migration SQL copied to clipboard", "success");
    } else {
      showToast("Failed to copy SQL", "error");
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-muted-foreground" />
            Pending database migrations
          </DialogTitle>
          <DialogDescription>
            Copy and apply these migrations in order, then refresh the status.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border bg-muted/40 p-4 text-sm">
          <div className="flex items-start gap-2 font-medium">
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
            How to apply migrations
          </div>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>Copy the SQL for each migration below</li>
            <li>Open your Supabase dashboard SQL Editor</li>
            <li>Paste and execute each migration in order</li>
            <li>Click "Refresh status" to verify the migrations were applied</li>
          </ol>
          {migrations.length > 1 && (
            <Button variant="outline" size="sm" onClick={handleCopyAll} className="mt-3">
              Copy all migrations
            </Button>
          )}
        </div>

        <Separator />

        <ScrollArea className="h-[45vh] pr-3">
          {migrations.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-sm text-muted-foreground">
              <CheckCircle className="h-10 w-10 text-foreground" />
              All migrations have been applied.
            </div>
          ) : (
            <div className="space-y-4 pb-4">
              {migrations.map((migration, index) => (
                <div key={`${migration.version}-${migration.name}`} className="rounded-md border p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h4 className="font-medium">{migration.name}</h4>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Version: {migration.version} • {migration.file_path}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopy(migration.sql_content, index)}
                      >
                        {copiedIndex === index ? (
                          <>
                            <CheckCircle className="h-4 w-4 text-foreground" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4" />
                            Copy SQL
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
                      >
                        {expandedIndex === index ? "Hide SQL" : "Show SQL"}
                      </Button>
                    </div>
                  </div>
                  {expandedIndex === index && (
                    <pre className="mt-3 rounded-md border bg-muted p-3 text-xs overflow-x-auto">
                      <code>{migration.sql_content}</code>
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button type="button" onClick={onMigrationsApplied}>
            Refresh status
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
