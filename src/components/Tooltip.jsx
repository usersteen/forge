import * as RadixTooltip from "@radix-ui/react-tooltip";

export function Tooltip({ label, side = "bottom", sideOffset = 6, children }) {
  if (!label) return children;
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          className="forge-tooltip"
          side={side}
          sideOffset={sideOffset}
          collisionPadding={8}
        >
          {label}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
