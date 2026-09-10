import {
  Root,
  Trigger,
  Value,
  Portal,
  Content,
  Viewport,
  Item,
  ItemText,
  ItemIndicator,
} from "radix-ui/select";
import { useMemo } from "react";
import { ChevronDownIcon, CheckIcon } from "@radix-ui/react-icons";
import type { SelectProps, SelectSize } from "../types/ui";

const sizes: Record<SelectSize, string> = {
  sm: "px-2.5 py-1 text-xs rounded-full",
  md: "px-3.5 py-2.5 text-sm rounded-[0.85rem]",
};

/**
 * Radix select.
 *
 * Long labels (person names especially) used to stretch the trigger and break
 * card layouts. `renderValue` fixes that without giving up the full text: pass a
 * compact chip (e.g. rounded initials) and the real label stays in the DOM via
 * visually hidden text, so screen readers still announce the selection.
 */
export function Select<TValue extends string = string>({
  value,
  onValueChange,
  options,
  placeholder,
  ariaLabel,
  size = "md",
  className = "",
  disabled,
  renderValue,
}: SelectProps<TValue>) {
  // Human-readable label of the current selection (used for the hidden
  // screen-reader text when a custom renderValue is supplied).
  const selectedLabel = useMemo(
    () => options.find((o) => o.value === value)?.label ?? "",
    [options, value],
  );

  const hasCustomValue = renderValue !== undefined && renderValue !== null;
  return (
    <Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <Trigger
        aria-label={ariaLabel}
        className={`control flex items-center justify-between gap-2 text-left ${sizes[size]} ${className}`}
      >
        {hasCustomValue ? (
          <>
            {/* Radix's <Value> ignores an added class, so it can never be hidden:
                its text stayed in the layout and printed the member's name a
                second time next to ours. Render our own screen-reader text
                instead — assistive tech still announces the selection. */}
            <span className="sr-only">{selectedLabel || placeholder || ""}</span>
            <span className="min-w-0 flex-1 truncate">{renderValue}</span>
          </>
        ) : (
          <Value placeholder={placeholder} className="min-w-0 flex-1 truncate" />
        )}
        <ChevronDownIcon width={12} height={12} className="shrink-0 opacity-60" />
      </Trigger>
      <Portal>
        <Content
          position="popper"
          sideOffset={4}
          className="glass-pop z-[120] max-h-72 w-[var(--radix-select-trigger-width)] min-w-[9rem] overflow-auto rounded-xl p-1"
        >
          <Viewport>
            {options.map((o) => (
              <Item
                key={o.value}
                value={o.value}
                disabled={o.disabled}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-sm outline-none data-[disabled]:opacity-50 data-[highlighted]:bg-[var(--accent-tint)] data-[highlighted]:text-[var(--ink)]"
              >
                <span className="min-w-0 flex-1 truncate" title={o.label}>
                  <ItemText>{o.label}</ItemText>
                </span>
                <ItemIndicator className="shrink-0">
                  <CheckIcon width={12} height={12} />
                </ItemIndicator>
              </Item>
            ))}
          </Viewport>
        </Content>
      </Portal>
    </Root>
  );
}

export default Select;
