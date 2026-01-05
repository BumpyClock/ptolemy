import { Trash2 } from "lucide-react";
import type React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/AlertDialog";
import { Button } from "@/components/ui/Button";

interface DeleteConfirmModalProps {
  itemName: string;
  onConfirm: () => void;
  onCancel: () => void;
  type: "project" | "task" | "client" | "document" | "knowledge";
  size?: "compact" | "default" | "large";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  itemName,
  onConfirm,
  onCancel,
  type,
  size = "default",
  open = false,
  onOpenChange,
}) => {
  const TITLES: Record<DeleteConfirmModalProps["type"], string> = {
    project: "Delete Project",
    task: "Delete Task",
    client: "Delete MCP Client",
    document: "Delete Document",
    knowledge: "Delete Knowledge Item",
  };

  const MESSAGES: Record<DeleteConfirmModalProps["type"], (_n: string) => string> = {
    project: (_n) => `Are you sure you want to delete this project?`,
    task: (_n) => `Are you sure you want to delete this task?`,
    client: (_n) => `Are you sure you want to delete this client?`,
    document: (_n) => `Are you sure you want to delete this document?`,
    knowledge: (n) =>
      `Are you sure you want to delete "${n}"? All associated documents and code examples will be permanently removed.`,
  };

  const iconSize = size === "compact" ? "h-4 w-4" : size === "large" ? "h-8 w-8" : "h-6 w-6";
  const iconContainer = size === "compact" ? "h-8 w-8" : size === "large" ? "h-16 w-16" : "h-12 w-12";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className={size === "compact" ? "max-w-sm" : size === "large" ? "max-w-lg" : "max-w-md"}>
        <AlertDialogHeader>
          <div className={`flex items-center gap-3 ${size === "compact" ? "mb-2" : "mb-3"}`}>
            <div className={`${iconContainer} rounded-full bg-destructive/10 flex items-center justify-center`}>
              <Trash2 className={`${iconSize} text-destructive`} />
            </div>
            <div>
              <AlertDialogTitle className={size === "compact" ? "text-base" : size === "large" ? "text-xl" : "text-lg"}>
                {TITLES[type]}
              </AlertDialogTitle>
              <AlertDialogDescription className={size === "compact" ? "text-xs" : size === "large" ? "text-base" : "text-sm"}>
                This action cannot be undone
              </AlertDialogDescription>
            </div>
          </div>
          <p className={`${size === "compact" ? "text-sm mb-3" : size === "large" ? "text-base mb-5" : "text-base mb-4"}`}>
            {MESSAGES[type](itemName)}
          </p>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button
              onClick={onCancel}
              variant="outline"
              size={size === "compact" ? "sm" : size === "large" ? "lg" : "default"}
            >
              Cancel
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              onClick={onConfirm}
              variant="destructive"
              size={size === "compact" ? "sm" : size === "large" ? "lg" : "default"}
            >
              Delete
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
