import * as Tip from "radix-ui/tooltip";

export function Tooltip({ content, side = "top", children }) {
  return (
    <Tip.Provider delayDuration={200}>
      <Tip.Root>
        <Tip.Trigger asChild>{children}</Tip.Trigger>
        <Tip.Portal>
          <Tip.Content
            side={side}
            sideOffset={6}
            className="glass-pop t-ink z-[110] rounded-lg px-2.5 py-1.5 text-xs font-medium"
            style={{ color: "var(--ink)" }}
          >
            {content}
          </Tip.Content>
        </Tip.Portal>
      </Tip.Root>
    </Tip.Provider>
  );
}

export default Tooltip;