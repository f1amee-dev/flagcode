import { useCallback, useState } from "react";
import type { CtfCategory, ModelSelection, SwarmMemberConfig } from "@flagcode/contracts";
import { SwarmId } from "@flagcode/contracts";
import { DEFAULT_MODEL_BY_PROVIDER } from "@flagcode/contracts";

import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogPanel,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { readEnvironmentApi } from "../environmentApi";
import { newCommandId } from "../lib/utils";
import { useStore } from "../store";
import { PlusIcon, TrashIcon, ZapIcon } from "lucide-react";
import { CtfCategoryPicker } from "./chat/CtfCategoryPicker";

/**
 * Available model choices for swarm solvers.
 * Uses the same canonical model slugs from @flagcode/contracts.
 */
const SWARM_MODEL_OPTIONS: Array<{
  label: string;
  provider: "claudeAgent" | "codex";
  selection: ModelSelection;
}> = [
  {
    label: "Claude Sonnet 4.6",
    provider: "claudeAgent",
    selection: { provider: "claudeAgent", model: "claude-sonnet-4-6" },
  },
  {
    label: "Claude Opus 4.6",
    provider: "claudeAgent",
    selection: { provider: "claudeAgent", model: "claude-opus-4-6" },
  },
  {
    label: "Claude Haiku 4.5",
    provider: "claudeAgent",
    selection: { provider: "claudeAgent", model: "claude-haiku-4-5" },
  },
  {
    label: "GPT 5.4 (Codex)",
    provider: "codex",
    selection: { provider: "codex", model: DEFAULT_MODEL_BY_PROVIDER.codex },
  },
];

interface SolverRow {
  key: string;
  modelIndex: number;
  label: string;
}

interface SwarmCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

export function SwarmCreationDialog({ open, onOpenChange, projectId }: SwarmCreationDialogProps) {
  const activeEnvironmentId = useStore((s) => s.activeEnvironmentId);

  const [title, setTitle] = useState("");
  const [challengePrompt, setChallengePrompt] = useState("");
  const [ctfCategory, setCtfCategory] = useState<CtfCategory | null>("misc");
  const [solvers, setSolvers] = useState<SolverRow[]>([
    { key: crypto.randomUUID(), modelIndex: 0, label: "Solver 1" },
    { key: crypto.randomUUID(), modelIndex: 1, label: "Solver 2" },
    { key: crypto.randomUUID(), modelIndex: 0, label: "Solver 3" },
  ]);
  const [creating, setCreating] = useState(false);

  const addSolver = useCallback(() => {
    setSolvers((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        modelIndex: 0,
        label: `Solver ${prev.length + 1}`,
      },
    ]);
  }, []);

  const removeSolver = useCallback((key: string) => {
    setSolvers((prev) => prev.filter((s) => s.key !== key));
  }, []);

  const updateSolver = useCallback((key: string, patch: Partial<SolverRow>) => {
    setSolvers((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }, []);

  const handleCreate = useCallback(async () => {
    if (!activeEnvironmentId || !title.trim() || !challengePrompt.trim() || solvers.length === 0)
      return;

    const api = readEnvironmentApi(activeEnvironmentId);
    if (!api) return;

    setCreating(true);
    try {
      const swarmId = SwarmId.make(crypto.randomUUID());
      const memberConfigs: SwarmMemberConfig[] = solvers.map((solver) => ({
        modelSelection:
          SWARM_MODEL_OPTIONS[solver.modelIndex]?.selection ?? SWARM_MODEL_OPTIONS[0]!.selection,
        label: solver.label || undefined,
      }));

      await api.orchestration.dispatchCommand({
        type: "swarm.create",
        commandId: newCommandId(),
        swarmId,
        projectId: projectId as any,
        title: title.trim(),
        challengePrompt: challengePrompt.trim(),
        ...(ctfCategory ? { ctfCategory } : {}),
        memberConfigs,
        createdAt: new Date().toISOString(),
      });

      onOpenChange(false);
      // Reset form
      setTitle("");
      setChallengePrompt("");
      setCtfCategory("misc");
      setSolvers([
        { key: crypto.randomUUID(), modelIndex: 0, label: "Solver 1" },
        { key: crypto.randomUUID(), modelIndex: 1, label: "Solver 2" },
        { key: crypto.randomUUID(), modelIndex: 0, label: "Solver 3" },
      ]);
    } catch (error) {
      console.error("Failed to create swarm:", error);
    } finally {
      setCreating(false);
    }
  }, [activeEnvironmentId, title, challengePrompt, ctfCategory, solvers, projectId, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Solver Swarm</DialogTitle>
          <DialogDescription>
            Launch multiple AI agents racing to solve a challenge in parallel.
          </DialogDescription>
        </DialogHeader>

        <DialogPanel>
          <div className="flex flex-col gap-4">
            {/* Title */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Swarm Title</label>
              <input
                type="text"
                className="rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                placeholder="e.g., DEFCON 2025 - Baby Crypto"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Challenge Prompt */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Challenge Prompt</label>
              <textarea
                className="min-h-[100px] rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                placeholder="Paste the challenge description, file paths, and any hints..."
                value={challengePrompt}
                onChange={(e) => setChallengePrompt(e.target.value)}
              />
            </div>

            {/* CTF Category */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">CTF Category</label>
              <CtfCategoryPicker value={ctfCategory} onChange={setCtfCategory} />
            </div>

            {/* Solver Rows */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">
                  Solvers ({solvers.length})
                </label>
                <Button variant="ghost" size="sm" onClick={addSolver}>
                  <PlusIcon className="mr-1 h-3.5 w-3.5" />
                  Add Solver
                </Button>
              </div>

              <div className="flex flex-col gap-2">
                {solvers.map((solver, idx) => (
                  <div
                    key={solver.key}
                    className="flex items-center gap-2 rounded-lg border bg-muted/40 p-2"
                  >
                    <input
                      type="text"
                      className="w-28 rounded border bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring"
                      value={solver.label}
                      onChange={(e) => updateSolver(solver.key, { label: e.target.value })}
                      placeholder={`Solver ${idx + 1}`}
                    />
                    <select
                      className="flex-1 rounded border bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring"
                      value={solver.modelIndex}
                      onChange={(e) =>
                        updateSolver(solver.key, {
                          modelIndex: Number(e.target.value),
                        })
                      }
                    >
                      {SWARM_MODEL_OPTIONS.map((m, i) => (
                        <option key={i} value={i}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                    {solvers.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => removeSolver(solver.key)}
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogPanel>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={creating || !title.trim() || !challengePrompt.trim() || solvers.length === 0}
          >
            <ZapIcon className="mr-1.5 h-4 w-4" />
            {creating ? "Creating..." : "Create & Start"}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
