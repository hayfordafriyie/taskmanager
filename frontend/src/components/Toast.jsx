import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as Toast from "radix-ui/toast";
import {
  CheckCircledIcon,
  CrossCircledIcon,
  InfoCircledIcon,
  Cross2Icon,
} from "@radix-ui/react-icons";

const ToastContext = createContext(null);

const variantClasses = {
  success: "border-emerald-200 dark:border-emerald-800",
  error: "border-red-200 dark:border-red-800",
  info: "border-zinc-200 dark:border-zinc-700",
};

const iconColors = {
  success: "text-emerald-600 dark:text-emerald-400",
  error: "text-red-600 dark:text-red-400",
  info: "text-indigo-600 dark:text-indigo-400",
};

function ToastIcon({ type }) {
  if (type === "success") {
    return <CheckCircledIcon className={`mt-0.5 shrink-0 ${iconColors[type] || iconColors.info}`} />;
  }
  if (type === "error") {
    return <CrossCircledIcon className={`mt-0.5 shrink-0 ${iconColors[type] || iconColors.info}`} />;
  }
  return <InfoCircledIcon className={`mt-0.5 shrink-0 ${iconColors[type] || iconColors.info}`} />;
}

export function ToastProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const nextId = useRef(0);

  const show = useCallback((options = {}) => {
    const type = options.type || options.kind || "info";
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

  const api = useMemo(() => {
    const make = (type) => (message, title) =>
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
          className={`toast-slide-in pointer-events-auto flex w-80 max-w-[calc(100vw-2rem)] items-start gap-3 rounded-md border bg-white p-4 shadow-lg dark:bg-zinc-900 ${
            toast ? variantClasses[toast.type] || variantClasses.info : variantClasses.info
          }`}
        >
          {toast && <ToastIcon type={toast.type} />}
          <div className="min-w-0 flex-1">
            <Toast.Title className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {toast?.title}
            </Toast.Title>
            {toast?.description && (
              <Toast.Description className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {toast.description}
              </Toast.Description>
            )}
          </div>
          <Toast.Close
            aria-label="Close"
            className="shrink-0 rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <Cross2Icon width={14} height={14} />
          </Toast.Close>
        </Toast.Root>
        <Toast.Viewport className="pointer-events-none fixed top-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2 outline-none" />
      </Toast.Provider>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

export default ToastProvider;