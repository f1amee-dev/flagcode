import type { EnvironmentId, ThreadId } from "@flagcode/contracts";
import { scopeThreadRef } from "@flagcode/client-runtime";
import { useCallback, useMemo, useState } from "react";
import { FileTextIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import { toastManager, type ThreadToastData } from "~/components/ui/toast";
import { Popover, PopoverPopup, PopoverTrigger } from "~/components/ui/popover";
import { selectThreadByRef, useStore } from "~/store";
import { getPrimaryEnvironmentConnection } from "~/environments/runtime";

interface WriteupButtonProps {
  cwd: string;
  activeThreadId: ThreadId;
  environmentId: EnvironmentId;
}

export default function WriteupButton({ cwd, activeThreadId, environmentId }: WriteupButtonProps) {
  const [isBusy, setIsBusy] = useState(false);
  const threadRef = useMemo(
    () => scopeThreadRef(environmentId, activeThreadId),
    [environmentId, activeThreadId],
  );
  const activeServerThread = useStore((store) => selectThreadByRef(store, threadRef));

  const hasMessages = (activeServerThread?.messages.length ?? 0) > 0;
  const isDisabled = isBusy || !hasMessages;
  const disabledReason = isBusy
    ? "Generating writeup..."
    : !hasMessages
      ? "Have a conversation first before creating a writeup."
      : null;

  const handleClick = useCallback(async () => {
    if (!activeServerThread) return;

    setIsBusy(true);
    const threadToastData: ThreadToastData = { threadId: activeThreadId };
    const toastId = toastManager.add({
      type: "loading",
      title: "Generating writeup...",
      timeout: 0,
      data: threadToastData,
    });

    try {
      const rpc = getPrimaryEnvironmentConnection().client;
      const result = await rpc.writeup.generate({
        cwd,
        threadTitle: activeServerThread.title,
        ctfCategory: activeServerThread.ctfCategory,
        messages: activeServerThread.messages.map((m) => ({
          role: m.role,
          text: m.text,
        })),
        modelSelection: activeServerThread.modelSelection,
      });

      toastManager.update(toastId, {
        type: "success",
        title: "Writeup saved",
        description: result.relativePath,
        data: {
          ...threadToastData,
          dismissAfterVisibleMs: 10_000,
        },
      });
    } catch (err) {
      toastManager.update(toastId, {
        type: "error",
        title: "Writeup failed",
        description: err instanceof Error ? err.message : "An error occurred.",
        data: threadToastData,
      });
    } finally {
      setIsBusy(false);
    }
  }, [activeServerThread, activeThreadId, cwd]);

  if (disabledReason) {
    return (
      <Popover>
        <PopoverTrigger
          openOnHover
          render={
            <Button
              aria-disabled="true"
              className="cursor-not-allowed opacity-64"
              size="xs"
              variant="outline"
            />
          }
        >
          <FileTextIcon className="size-3.5" />
          <span className="sr-only @3xl/header-actions:not-sr-only @3xl/header-actions:ml-0.5">
            Create Writeup
          </span>
        </PopoverTrigger>
        <PopoverPopup tooltipStyle side="bottom" align="start">
          {disabledReason}
        </PopoverPopup>
      </Popover>
    );
  }

  return (
    <Button variant="outline" size="xs" disabled={isDisabled} onClick={() => void handleClick()}>
      <FileTextIcon className="size-3.5" />
      <span className="sr-only @3xl/header-actions:not-sr-only @3xl/header-actions:ml-0.5">
        Create Writeup
      </span>
    </Button>
  );
}
