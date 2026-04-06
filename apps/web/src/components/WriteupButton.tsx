import type { ThreadId } from "@flagcode/contracts";
import { useCallback, useState } from "react";
import { FileTextIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import { toastManager, type ThreadToastData } from "~/components/ui/toast";
import { Popover, PopoverPopup, PopoverTrigger } from "~/components/ui/popover";
import { useStore } from "~/store";
import { getWsRpcClient } from "~/wsRpcClient";

interface WriteupButtonProps {
  cwd: string;
  activeThreadId: ThreadId;
}

export default function WriteupButton({ cwd, activeThreadId }: WriteupButtonProps) {
  const [isBusy, setIsBusy] = useState(false);
  const activeServerThread = useStore((store) =>
    store.threads.find((thread) => thread.id === activeThreadId),
  );

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
      const rpc = getWsRpcClient();
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
