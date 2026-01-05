import { Bug, Loader } from "lucide-react";
import { Button } from "../ui/Button";
import { BugReportModal } from "./BugReportModal";
import { useBugReport } from "../../hooks/useBugReport";

interface BugReportButtonProps {
  error?: Error;
  variant?: "default" | "secondary" | "ghost" | "outline" | "destructive" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  children?: React.ReactNode;
}

export const BugReportButton: React.FC<BugReportButtonProps> = ({
  error,
  variant = "ghost",
  size = "default",
  className = "",
  children,
}) => {
  const { isOpen, context, loading, openBugReport, closeBugReport } =
    useBugReport();

  const handleClick = () => {
    openBugReport(error);
  };

  return (
    <>
      <Button
        onClick={handleClick}
        disabled={loading}
        variant={variant}
        size={size}
        className={className}
      >
        {loading ? (
          <Loader className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Bug className="w-4 h-4 mr-2" />
        )}
        {children || "Report Bug"}
      </Button>

      {context && (
        <BugReportModal
          isOpen={isOpen}
          onClose={closeBugReport}
          context={context}
        />
      )}
    </>
  );
};
