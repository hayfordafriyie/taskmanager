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
import { ChevronDownIcon, CheckIcon } from "@radix-ui/react-icons";

const sizes = {
  sm: "px-2.5 py-1 text-xs rounded-full",
  md: "px-3.5 py-2.5 text-sm rounded-[0.85rem]",
};

/**
 * Radix select.
 *
 * Long labels (person names especially) used to stretch the trigger and break
 * card layouts. Two optional props fix that without giving up the full text:
 *
 *  - renderValue: node shown in the trigger instead of the raw label — pass a
 *    compact chip (e.g. rounded initials). The real label stays in the DOM via
 *    a visually hidden Select.Value, so screen readers and the native form
 *    fallback still get the full name.
 *  - renderOption: node shown for each row in the dropdown (the dropdown can
 *    afford the full name, truncated rather than overflowing).
 */
export function Select({
  value,
  onValueChange,
  options,
  placeholder,
  ariaLabel,
  size = "md",
  className = "",
  disabled,
  renderValue,
  renderOption,
}) {
  const hasCustomValue = renderValue !== undefined && renderValue !== null;
  return (
    <Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <Trigger
        aria-label={ariaLabel}
        className={`control flex items-center justify-between gap-2 text-left ${sizes[size]} ${className}`}
      >
        {hasCustomValue ? (
          <>
            <Value className="sr-only" placeholder={placeholder} />
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
                {renderOption ? (
                  <>
                    {/* Keeps the full label for a11y + the native fallback. */}
                    <ItemText className="sr-only">{o.label}</ItemText>
                    <span className="min-w-0 flex-1">{renderOption(o)}</span>
                  </>
                ) : (
                  <ItemText className="min-w-0 truncate">{o.label}</ItemText>
                )}
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
