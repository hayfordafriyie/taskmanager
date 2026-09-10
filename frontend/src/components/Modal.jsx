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

const sizes = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
};

export function Modal({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  size = "md",
  children,
  footer,
}) {
  return (
    <Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Trigger asChild>{trigger}</Trigger>}
      <Portal>
        <Overlay className="bg-black/40 fixed inset-0 z-[80] backdrop-blur-sm" />
        <Content
          className={`glass-pop fixed left-1/2 top-1/2 z-[90] w-[calc(100vw-2rem)] max-h-[calc(100vh-3rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl p-5 sm:w-full ${sizes[size]}`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <Title className="font-display text-lg font-semibold t-ink">{title}</Title>
              {description && <Description className="mt-1 text-sm t-soft">{description}</Description>}
            </div>
            <Close
              aria-label="Close"
              className="btn-gloss-ghost grid h-8 w-8 shrink-0 place-items-center rounded-full"
            >
              <Cross2Icon width={15} height={15} />
            </Close>
          </div>

          <div className="mt-4">{children}</div>

          {footer && <div className="mt-5 flex flex-wrap items-center justify-end gap-2">{footer}</div>}
        </Content>
      </Portal>
    </Root>
  );
}

export default Modal;