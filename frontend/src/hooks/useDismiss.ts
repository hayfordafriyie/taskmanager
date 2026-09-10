import { useEffect } from "react";
import type { RefObject } from "react";

// Closes popovers/drawers/overlays on outside click or Escape.
// ref must wrap the trigger + panel for popovers; for a scrim overlay, point
// it at the scrim (clicks landing on a child panel don't dismiss).
export function useDismissOnOutside(
  ref: RefObject<HTMLElement | null>,
  onClose: () => void,
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = (e: MouseEvent) => {
      const el = ref.current;
      if (el && !el.contains(e.target as Node)) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [ref, onClose, enabled]);
}

export default useDismissOnOutside;
