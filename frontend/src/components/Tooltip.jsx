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
            className="z-[110] rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-zinc-100 shadow-lg dark:bg-zinc-100 dark:text-zinc-900"
          >
            {content}
          </Tip.Content>
        </Tip.Portal>
      </Tip.Root>
    </Tip.Provider>
  );
}

export default Tooltip;