import { useEffect, useRef, useState } from "react";
import type { SwarmFinding } from "../types";
import {
  LightbulbIcon,
  CrosshairIcon,
  AlertTriangleIcon,
  ActivityIcon,
  FlagIcon,
} from "lucide-react";

const FINDING_KIND_STYLES: Record<
  string,
  { icon: typeof LightbulbIcon; color: string; bg: string }
> = {
  discovery: {
    icon: LightbulbIcon,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
  hypothesis: {
    icon: CrosshairIcon,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  progress: {
    icon: ActivityIcon,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  error: {
    icon: AlertTriangleIcon,
    color: "text-red-500",
    bg: "bg-red-500/10",
  },
  flag: {
    icon: FlagIcon,
    color: "text-yellow-500",
    bg: "bg-yellow-500/10",
  },
};

// Thread color assignment - distinct colors for each solver thread
const THREAD_COLORS = [
  "border-l-violet-500",
  "border-l-cyan-500",
  "border-l-orange-500",
  "border-l-pink-500",
  "border-l-lime-500",
  "border-l-sky-500",
];

interface SwarmFindingsFeedProps {
  findings: SwarmFinding[];
  threadLabels?: Record<string, string>;
}

export function SwarmFindingsFeed({ findings, threadLabels = {} }: SwarmFindingsFeedProps) {
  const feedRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Thread color mapping
  const threadColorMap = useRef(new Map<string, string>());
  const getThreadColor = (threadId: string): string => {
    if (!threadColorMap.current.has(threadId)) {
      const idx = threadColorMap.current.size % THREAD_COLORS.length;
      threadColorMap.current.set(threadId, THREAD_COLORS[idx]!);
    }
    return threadColorMap.current.get(threadId)!;
  };

  useEffect(() => {
    if (autoScroll && feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [findings.length, autoScroll]);

  const handleScroll = () => {
    if (!feedRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = feedRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 40);
  };

  if (findings.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
        Waiting for findings from solver threads...
      </div>
    );
  }

  return (
    <div
      ref={feedRef}
      onScroll={handleScroll}
      className="flex max-h-64 flex-col gap-1 overflow-y-auto p-2"
    >
      {findings.map((finding) => {
        const style = FINDING_KIND_STYLES[finding.kind] ?? FINDING_KIND_STYLES.progress!;
        const Icon = style.icon;
        const threadColor = getThreadColor(finding.threadId);
        const threadLabel = threadLabels[finding.threadId] ?? finding.threadId.slice(0, 12);

        return (
          <div
            key={finding.id}
            className={`flex items-start gap-2 rounded-md border-l-2 ${threadColor} bg-muted/30 px-3 py-1.5 text-sm`}
          >
            <div className={`mt-0.5 flex-shrink-0 rounded p-0.5 ${style.bg}`}>
              <Icon className={`h-3.5 w-3.5 ${style.color}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">{threadLabel}</span>
                <span className="text-[10px] text-muted-foreground/60">
                  {new Date(finding.createdAt).toLocaleTimeString()}
                </span>
              </div>
              <p className="mt-0.5 break-words leading-snug text-foreground/90">
                {finding.summary}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
