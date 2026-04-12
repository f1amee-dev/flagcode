import { memo, useMemo } from "react";
import type { ThreadId } from "@flagcode/contracts";
import type { ChatMessage, ThreadSession } from "../types";
import { useStore, selectThreadByRef } from "../store";
import { ActivityIcon, CheckCircleIcon, XCircleIcon, LoaderIcon } from "lucide-react";
import { useRouter } from "@tanstack/react-router";

const MAX_VISIBLE_MESSAGES = 5;

interface SwarmThreadPanelProps {
  threadId: ThreadId;
  environmentId: string;
  label: string;
  isWinner: boolean;
}

function ThreadStatusPill({ session }: { session: ThreadSession | null }) {
  if (!session) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
        <ActivityIcon className="h-2.5 w-2.5" />
        Idle
      </span>
    );
  }

  const statusConfig: Record<string, { color: string; label: string; icon: typeof LoaderIcon }> = {
    running: { color: "bg-blue-500/15 text-blue-600", label: "Working...", icon: LoaderIcon },
    ready: { color: "bg-emerald-500/15 text-emerald-600", label: "Ready", icon: CheckCircleIcon },
    error: { color: "bg-red-500/15 text-red-600", label: "Error", icon: XCircleIcon },
    disconnected: { color: "bg-muted text-muted-foreground", label: "Offline", icon: XCircleIcon },
  };

  const config = statusConfig[session.status] ?? statusConfig.disconnected!;
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${config.color}`}
    >
      <Icon className={`h-2.5 w-2.5 ${session.status === "running" ? "animate-spin" : ""}`} />
      {config.label}
    </span>
  );
}

export const SwarmThreadPanel = memo(function SwarmThreadPanel({
  threadId,
  environmentId,
  label,
  isWinner,
}: SwarmThreadPanelProps) {
  const router = useRouter();
  const thread = useStore((state) =>
    selectThreadByRef(state, { environmentId: environmentId as any, threadId }),
  );

  const recentMessages = useMemo(() => {
    if (!thread) return [];
    return thread.messages
      .filter((m) => m.role === "assistant" && m.text.length > 0)
      .slice(-MAX_VISIBLE_MESSAGES);
  }, [thread]);

  const handleExpand = () => {
    router.navigate({
      to: "/$environmentId/$threadId",
      params: { environmentId, threadId },
    });
  };

  if (!thread) {
    return (
      <div className="flex flex-1 flex-col rounded-lg border bg-card p-3">
        <div className="text-sm font-medium text-muted-foreground">{label}</div>
        <div className="mt-2 text-xs text-muted-foreground">Thread not found</div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-1 flex-col rounded-lg border bg-card ${
        isWinner ? "border-yellow-500/50 ring-1 ring-yellow-500/20" : ""
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{label}</span>
          {isWinner && (
            <span className="rounded-full bg-yellow-500/15 px-2 py-0.5 text-[10px] font-bold text-yellow-600">
              WINNER
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ThreadStatusPill session={thread.session} />
          <button
            onClick={handleExpand}
            className="rounded px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Expand
          </button>
        </div>
      </div>

      {/* Compact message timeline */}
      <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
        {recentMessages.length === 0 ? (
          <div className="flex items-center justify-center py-4 text-xs text-muted-foreground">
            {thread.session?.status === "running" ? "Thinking..." : "No messages yet"}
          </div>
        ) : (
          recentMessages.map((message) => <CompactMessage key={message.id} message={message} />)
        )}
      </div>

      {/* Model indicator */}
      <div className="border-t px-3 py-1">
        <span className="text-[10px] text-muted-foreground">{thread.modelSelection.model}</span>
      </div>
    </div>
  );
});

function CompactMessage({ message }: { message: ChatMessage }) {
  const truncatedText =
    message.text.length > 150 ? `${message.text.slice(0, 147)}...` : message.text;

  return (
    <div className="rounded bg-muted/40 px-2 py-1 text-xs leading-relaxed text-foreground/80">
      {truncatedText}
      {message.streaming && (
        <span className="ml-1 inline-block h-2 w-2 animate-pulse rounded-full bg-blue-500" />
      )}
    </div>
  );
}
