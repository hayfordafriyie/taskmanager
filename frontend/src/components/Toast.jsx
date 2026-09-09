import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import * as Toast from "radix-ui/toast";

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
  const className = `mt-0.5 shrink-0 ${iconColors[type] || iconColors.info}`;
  if (type === "success") {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
        <path d="M3.5 8.5L6.5 11.5L12.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (type === "error") {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
        <path d="M8 4.5V9M8 11.5V11.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 7.5V11M8 5.25V5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
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

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Toast.Provider duration={toast?.duration ?? 5000} swipeDirection="right">
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
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M3.5 3.5L10.5 10.5M10.5 3.5L3.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </Toast.Close>
        </Toast.Root>
        <Toast.Viewport className="pointer-events-none fixed right-4 bottom-4 z-[100] flex w-full max-w-sm flex-col gap-2 outline-none" />
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