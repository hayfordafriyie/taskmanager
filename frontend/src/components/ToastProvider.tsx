import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Toast from "radix-ui/toast";
import {
  CheckCircledIcon,
  CrossCircledIcon,
  InfoCircledIcon,
  Cross2Icon,
} from "@radix-ui/react-icons";
import { ToastContext } from "./toastContext";
import type {
  ToastApi,
  ToastIconProps,
  ToastOptions,
  ToastProviderProps,
  ToastRecord,
  ToastType,
} from "../types/ui";

const iconColors: Record<ToastType, string> = {
  success: "text-emerald-600 dark:text-emerald-400",
  error: "text-rose-600 dark:text-rose-400",
  info: "accent-text",
};

function ToastIcon({ type }: ToastIconProps) {
  const className = `mt-0.5 shrink-0 ${iconColors[type] || iconColors.info}`;
  if (type === "success") {
    return <CheckCircledIcon className={className} />;
  }
  if (type === "error") {
    return <CrossCircledIcon className={className} />;
  }
  return <InfoCircledIcon className={className} />;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [open, setOpen] = useState<boolean>(false);
  const [toast, setToast] = useState<ToastRecord | null>(null);
  const nextId = useRef<number>(0);

  const show = useCallback((options: ToastOptions = {}) => {
    const type: ToastType = options.type || options.kind || "info";
    nextId.current += 1;
    setToast({
      id: nextId.current,
      type,
      title:
        options.title ??
        (type === "success"
          ? "Success"
          : type === "error"
            ? "Error"
            : "Notice"),
      description: options.description ?? options.text ?? "",
      duration: options.duration ?? 5000,
    });
    setOpen(true);
  }, []);

  const api = useMemo<ToastApi>(() => {
    const make =
      (type: ToastType) =>
      (message?: string, title?: string) =>
        show({ type, description: message, title });
    return {
      show,
      success: make("success"),
      error: make("error"),
      info: make("info"),
    };
  }, [show]);

  useEffect(() => {
    if (!open || !toast) {
      return;
    }
    const id = setTimeout(() => setOpen(false), toast.duration ?? 5000);
    return () => clearTimeout(id);
  }, [open, toast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Toast.Provider duration={24 * 60 * 60 * 1000} swipeDirection="right">
        <Toast.Root
          key={toast?.id}
          open={open}
          onOpenChange={setOpen}
          className="toast-slide-in glass-pop pointer-events-auto flex w-80 max-w-[calc(100vw-2rem)] items-start gap-3 rounded-2xl p-4"
        >
          {toast && <ToastIcon type={toast.type} />}
          <div className="min-w-0 flex-1">
            <Toast.Title className="t-ink text-sm font-semibold">
              {toast?.title}
            </Toast.Title>
            {toast?.description && (
              <Toast.Description className="t-soft mt-1 text-sm">
                {toast.description}
              </Toast.Description>
            )}
          </div>
          <Toast.Close
            aria-label="Close"
            className="ring-accent t-faint shrink-0 rounded-lg p-1 transition-colors hover:bg-[var(--glass-b)] hover:text-[var(--ink)]"
          >
            <Cross2Icon width={14} height={14} />
          </Toast.Close>
        </Toast.Root>
        <Toast.Viewport className="pointer-events-none fixed inset-x-0 top-[calc(4.75rem+env(safe-area-inset-top,0px))] z-[100] flex flex-col items-center gap-2 px-3 outline-none sm:inset-x-auto sm:top-4 sm:right-4 sm:w-full sm:max-w-sm sm:items-end sm:px-0" />
      </Toast.Provider>
    </ToastContext.Provider>
  );
}

export default ToastProvider;
