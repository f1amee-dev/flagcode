import { type ReactNode, useCallback, useState } from "react";
import { Undo2Icon } from "lucide-react";
import { type CtfCategory } from "@flagcode/contracts";
import { CTF_CATEGORIES, DEFAULT_CTF_PROMPTS } from "@flagcode/shared/ctf";

import { useSettings, useUpdateSettings } from "../../hooks/useSettings";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

// ── Shared layout primitives (mirrors SettingsPanels.tsx) ───────────

function SettingsPageContainer({ children }: { children: ReactNode }) {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">{children}</div>
    </div>
  );
}

function SettingsSection({
  title,
  icon,
  headerAction,
  children,
}: {
  title: string;
  icon?: ReactNode;
  headerAction?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {icon}
          {title}
        </h2>
        {headerAction}
      </div>
      <div className="relative overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-xs/5 not-dark:bg-clip-padding before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-2xl)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] dark:before:shadow-[0_-1px_--theme(--color-white/6%)]">
        {children}
      </div>
    </section>
  );
}

function SettingsRow({
  title,
  description,
  resetAction,
  control,
  children,
}: {
  title: ReactNode;
  description: string;
  resetAction?: ReactNode;
  control?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="border-t border-border px-4 py-4 first:border-t-0 sm:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex min-h-5 items-center gap-1.5">
            <h3 className="text-sm font-medium text-foreground">{title}</h3>
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
              {resetAction}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        {control ? (
          <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto sm:justify-end">
            {control}
          </div>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function SettingResetButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label={`Reset ${label} to default`}
            className="size-5 rounded-sm p-0 text-muted-foreground hover:text-foreground"
            onClick={(event) => {
              event.stopPropagation();
              onClick();
            }}
          />
        }
      >
        <Undo2Icon className="size-3" />
      </TooltipTrigger>
      <TooltipPopup>Reset to default</TooltipPopup>
    </Tooltip>
  );
}

// ── Category prompt editor ──────────────────────────────────────────

function CategoryPromptRow({
  categoryId,
  label,
  description,
  customPrompt,
  onSave,
  onReset,
}: {
  categoryId: CtfCategory;
  label: string;
  description: string;
  customPrompt: string | undefined;
  onSave: (categoryId: CtfCategory, value: string) => void;
  onReset: (categoryId: CtfCategory) => void;
}) {
  const defaultPrompt = DEFAULT_CTF_PROMPTS[categoryId];
  const effectivePrompt = customPrompt ?? defaultPrompt;
  const [draft, setDraft] = useState(effectivePrompt);
  const isModified = customPrompt !== undefined;
  const isDirty = draft !== effectivePrompt;

  const handleReset = useCallback(() => {
    onReset(categoryId);
    setDraft(defaultPrompt);
  }, [categoryId, defaultPrompt, onReset]);

  return (
    <SettingsRow
      title={label}
      description={description}
      resetAction={isModified ? <SettingResetButton label={label} onClick={handleReset} /> : null}
    >
      <div className="mt-3 space-y-2">
        <textarea
          className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
          rows={8}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        {isDirty ? (
          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="text-xs"
              onClick={() => setDraft(effectivePrompt)}
            >
              Discard
            </Button>
            <Button size="sm" className="text-xs" onClick={() => onSave(categoryId, draft)}>
              Save
            </Button>
          </div>
        ) : null}
      </div>
    </SettingsRow>
  );
}

// ── Main panel ──────────────────────────────────────────────────────

export function CtfSettingsPanel() {
  const settings = useSettings();
  const { updateSettings } = useUpdateSettings();

  const handleSavePrompt = useCallback(
    (categoryId: CtfCategory, value: string) => {
      updateSettings({
        ctfCustomPrompts: {
          ...settings.ctfCustomPrompts,
          [categoryId]: value,
        },
      });
    },
    [settings.ctfCustomPrompts, updateSettings],
  );

  const handleResetPrompt = useCallback(
    (categoryId: CtfCategory) => {
      const next = { ...settings.ctfCustomPrompts };
      delete next[categoryId];
      updateSettings({ ctfCustomPrompts: next });
    },
    [settings.ctfCustomPrompts, updateSettings],
  );

  return (
    <SettingsPageContainer>
      <SettingsSection title="System Prompts">
        {CTF_CATEGORIES.map((cat) => (
          <CategoryPromptRow
            key={cat.id}
            categoryId={cat.id}
            label={cat.label}
            description={cat.description}
            customPrompt={settings.ctfCustomPrompts[cat.id]}
            onSave={handleSavePrompt}
            onReset={handleResetPrompt}
          />
        ))}
      </SettingsSection>

      <SettingsSection title="Binary Ninja">
        <SettingsRow
          title="Binary Ninja MCP"
          description="Enable Binary Ninja MCP tools for Pwn and Reverse Engineering agents."
          control={
            <Switch
              checked={settings.binaryNinjaEnabled}
              onCheckedChange={(checked) =>
                updateSettings({ binaryNinjaEnabled: Boolean(checked) })
              }
              aria-label="Enable Binary Ninja MCP integration"
            />
          }
        >
          {settings.binaryNinjaEnabled ? (
            <div className="mt-3 space-y-2 rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
              <p>
                Binary Ninja MCP tools are automatically available to Pwn and Reverse Engineering
                agents when enabled.
              </p>
              <p>
                To set up Binary Ninja MCP, install the binary-ninja-mcp server and configure it in
                your Claude settings.
              </p>
            </div>
          ) : null}
        </SettingsRow>
      </SettingsSection>
    </SettingsPageContainer>
  );
}
