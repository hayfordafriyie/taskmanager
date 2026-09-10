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

export function Select({
  value,
  onValueChange,
  options,
  placeholder,
  ariaLabel,
  size = "md",
  className = "",
  disabled,
}) {
  return (
    <Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <Trigger
        aria-label={ariaLabel}
        className={`control flex items-center justify-between gap-2 text-left ${sizes[size]} ${className}`}
      >
        <Value placeholder={placeholder} />
        <ChevronDownIcon width={12} height={12} className="shrink-0 opacity-60" />
      </Trigger>
      <Portal>
        <Content
          position="popper"
          sideOffset={4}
          className="glass-pop z-[120] max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-auto rounded-xl p-1"
        >
          <Viewport>
            {options.map((o) => (
              <Item
                key={o.value}
                value={o.value}
                disabled={o.disabled}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-sm outline-none data-[disabled]:opacity-50 data-[highlighted]:bg-[var(--accent-tint)] data-[highlighted]:text-[var(--ink)]"
              >
                <ItemText>{o.label}</ItemText>
                <ItemIndicator>
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
