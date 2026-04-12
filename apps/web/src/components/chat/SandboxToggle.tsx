import { memo, useCallback } from "react";
import { ContainerIcon } from "lucide-react";
import { Button } from "../ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { cn } from "~/lib/utils";

export const SandboxToggle = memo(function SandboxToggle(props: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
}) {
  const handleClick = useCallback(() => {
    if (props.disabled) return;
    props.onChange(!props.enabled);
  }, [props.disabled, props.enabled]);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            size="sm"
            variant="ghost"
            className={cn(
              "min-w-0 shrink-0 px-2 [&_svg]:mx-0",
              props.enabled
                ? "text-foreground/80 hover:text-foreground"
                : "text-muted-foreground/70 hover:text-foreground/80",
            )}
            disabled={props.disabled}
            onClick={handleClick}
          />
        }
      >
        <span className="flex items-center gap-1.5">
          <ContainerIcon
            aria-hidden="true"
            className={cn("size-4 shrink-0", props.enabled ? "text-blue-500" : undefined)}
          />
          <span className="text-xs">{props.enabled ? "Sandbox" : "Sandbox"}</span>
        </span>
      </TooltipTrigger>
      <TooltipPopup>
        {props.enabled
          ? "Docker sandbox enabled — agent will have access to CTF tools via the sb command"
          : "Enable Docker sandbox for CTF tool access"}
      </TooltipPopup>
    </Tooltip>
  );
});
