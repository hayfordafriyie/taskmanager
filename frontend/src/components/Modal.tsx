import {
  Root,
  Trigger,
  Portal,
  Overlay,
  Content,
  Title,
  Description,
  Close,
} from "radix-ui/dialog";
import { Cross2Icon } from "@radix-ui/react-icons";
import type { ModalProps } from "../types/ui";

export function Modal({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  size = "md",
  children,
  footer,
}: ModalProps) {
  return (
    <Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Trigger asChild>{trigger}</Trigger>}
      <Portal>
        <Overlay className="overlay-in bg-black/40 fixed inset-0 z-[80] backdrop-blur-sm" />
        <Content
          aria-label={typeof title === "string" ? title : undefined}
          className={[
            "glass-pop drawer-in fixed inset-x-0 bottom-0 z-[90] mx-auto w-full max-h-[calc(100vh-3rem)] rounded-t-[1.25rem] p-5 overflow-y-auto",
            size === "sm" && "sm:max-w-sm",
            size === "md" && "sm:max-w-lg",
            size === "lg" && "sm:max-w-2xl",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--border-soft)]" />
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <Title className="font-display text-lg font-semibold t-ink">
                {title}
              </Title>
              {description && (
                <Description className="mt-1 text-sm t-soft">
                  {description}
                </Description>
              )}
            </div>
            <Close
              aria-label="Close"
              className="btn-gloss-ghost grid h-8 w-8 shrink-0 place-items-center rounded-full"
            >
              <Cross2Icon width={15} height={15} />
            </Close>
          </div>

          <div className="mt-4">{children}</div>

          {footer && (
            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              {footer}
            </div>
          )}
        </Content>
      </Portal>
    </Root>
  );
}

export default Modal;
