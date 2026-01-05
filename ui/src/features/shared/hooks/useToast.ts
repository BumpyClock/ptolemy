import { toast } from "sonner";

type ToastType = "success" | "error" | "info" | "warning";

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  removeToast: (id?: string | number) => void;
}

/**
 * Hook to show toast notifications via Sonner.
 */
export function useToast(): ToastContextType {
  const showToast = (message: string, type: ToastType = "info", duration = 4000) => {
    const options = duration ? { duration } : undefined;
    switch (type) {
      case "success":
        toast.success(message, options);
        break;
      case "error":
        toast.error(message, options);
        break;
      case "warning":
        toast.warning(message, options);
        break;
      default:
        toast(message, options);
    }
  };

  const removeToast = (id?: string | number) => {
    if (id !== undefined) {
      toast.dismiss(id);
    } else {
      toast.dismiss();
    }
  };

  return { showToast, removeToast };
}

export type { ToastContextType };
