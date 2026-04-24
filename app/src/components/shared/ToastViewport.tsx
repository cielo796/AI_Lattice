"use client";

import { Icon } from "@/components/shared/Icon";
import { cn } from "@/lib/cn";
import { useToastStore, type ToastVariant } from "@/stores/toastStore";

const variantStyles: Record<
  ToastVariant,
  { icon: string; accent: string; border: string }
> = {
  success: {
    icon: "check_circle",
    accent: "text-primary",
    border: "border-primary/30",
  },
  error: {
    icon: "error",
    accent: "text-error",
    border: "border-error/30",
  },
  info: {
    icon: "info",
    accent: "text-blue-300",
    border: "border-blue-300/30",
  },
};

export function ToastViewport() {
  const toasts = useToastStore((state) => state.toasts);
  const removeToast = useToastStore((state) => state.removeToast);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed right-4 top-20 z-[100] w-[calc(100vw-2rem)] max-w-sm space-y-2">
      {toasts.map((toast) => {
        const styles = variantStyles[toast.variant];

        return (
          <div
            key={toast.id}
            role={toast.variant === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-lg border bg-surface-container-high px-4 py-3 shadow-2xl",
              styles.border
            )}
          >
            <Icon
              name={styles.icon}
              size="sm"
              className={cn("mt-0.5", styles.accent)}
            />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-on-surface">{toast.title}</div>
              {toast.description && (
                <div className="mt-1 text-xs leading-relaxed text-on-surface-variant">
                  {toast.description}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface"
              aria-label="通知を閉じる"
            >
              <Icon name="close" size="sm" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
