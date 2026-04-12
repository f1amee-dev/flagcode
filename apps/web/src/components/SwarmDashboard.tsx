import { useCallback, useMemo, useState } from "react";
import type { SwarmId } from "@flagcode/contracts";
import type { SwarmFinding } from "../types";
import { useStore } from "../store";
import { readEnvironmentApi } from "../environmentApi";
import { newCommandId } from "../lib/utils";
import { Button } from "./ui/button";
import { SwarmThreadPanel } from "./SwarmThreadPanel";
import { SwarmFindingsFeed } from "./SwarmFindingsFeed";
import {
  FlagIcon,
  SquareIcon,
  ZapIcon,
  CheckCircle2Icon,
  XCircleIcon,
  ClockIcon,
  AlertTriangleIcon,
} from "lucide-react";

const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    color: string;
    icon: typeof ZapIcon;
  }
> = {
  pending: {
    label: "Pending",
    color: "bg-muted text-muted-foreground",
    icon: ClockIcon,
  },
  running: {
    label: "Running",
    color: "bg-blue-500/15 text-blue-600",
    icon: ZapIcon,
  },
  solved: {
    label: "Solved",
    color: "bg-emerald-500/15 text-emerald-600",
    icon: CheckCircle2Icon,
  },
  stopped: {
    label: "Stopped",
    color: "bg-muted text-muted-foreground",
    icon: SquareIcon,
  },
  failed: {
    label: "Failed",
    color: "bg-red-500/15 text-red-600",
    icon: AlertTriangleIcon,
  },
};

interface SwarmDashboardProps {
  swarmId: SwarmId;
  environmentId: string;
}

export function SwarmDashboard({ swarmId, environmentId }: SwarmDashboardProps) {
  const swarm = useStore((state) => {
    const envState = state.environmentStateById[environmentId];
    return envState?.swarmById[swarmId] ?? null;
  });

  // Findings state (would be populated via WS subscription in production)
  const [findings, _setFindings] = useState<SwarmFinding[]>([]);

  const handleStop = useCallback(async () => {
    const api = readEnvironmentApi(environmentId as any);
    if (!api || !swarm) return;

    try {
      await api.orchestration.dispatchCommand({
        type: "swarm.stop",
        commandId: newCommandId(),
        swarmId,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Failed to stop swarm:", error);
    }
  }, [environmentId, swarmId, swarm]);

  if (!swarm) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Swarm not found
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[swarm.status] ?? STATUS_CONFIG.pending!;
  const StatusIcon = statusConfig.icon;

  // Build thread labels from member configs
  const threadLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    swarm.threadIds.forEach((threadId, idx) => {
      const config = swarm.memberConfigs[idx];
      labels[threadId] = config?.label ?? `Solver ${idx + 1}`;
    });
    return labels;
  }, [swarm.threadIds, swarm.memberConfigs]);

  return (
    <div className="flex h-full flex-col">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">{swarm.title}</h1>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${statusConfig.color}`}
          >
            <StatusIcon className="h-3.5 w-3.5" />
            {statusConfig.label}
          </span>
          <span className="text-sm text-muted-foreground">
            {swarm.threadIds.length} solver{swarm.threadIds.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Flag value display */}
          {swarm.flagValue && (
            <div className="flex items-center gap-1.5 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-1.5">
              <FlagIcon className="h-4 w-4 text-yellow-600" />
              <code className="text-sm font-mono font-medium text-yellow-700 dark:text-yellow-400">
                {swarm.flagValue}
              </code>
            </div>
          )}

          {/* Stop button */}
          {(swarm.status === "running" || swarm.status === "pending") && (
            <Button variant="outline" size="sm" onClick={handleStop}>
              <SquareIcon className="mr-1.5 h-3.5 w-3.5" />
              Stop All
            </Button>
          )}
        </div>
      </div>

      {/* Thread panels grid */}
      <div className="flex-1 overflow-hidden">
        <div className="flex h-full flex-col">
          {/* Thread columns */}
          <div className="flex flex-1 gap-3 overflow-x-auto p-4">
            {swarm.threadIds.map((threadId, idx) => (
              <SwarmThreadPanel
                key={threadId}
                threadId={threadId}
                environmentId={environmentId}
                label={threadLabels[threadId] ?? `Solver ${idx + 1}`}
                isWinner={swarm.winnerThreadId === threadId}
              />
            ))}

            {swarm.threadIds.length === 0 && swarm.status === "pending" && (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                Swarm is pending. Threads will be created when started.
              </div>
            )}
          </div>

          {/* Findings feed */}
          <div className="border-t">
            <div className="flex items-center gap-2 px-4 py-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Findings Feed
              </span>
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {findings.length}
              </span>
            </div>
            <SwarmFindingsFeed findings={findings} threadLabels={threadLabels} />
          </div>
        </div>
      </div>
    </div>
  );
}
