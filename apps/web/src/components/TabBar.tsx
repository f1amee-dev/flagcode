import { Link } from "@tanstack/react-router";
import { XIcon } from "lucide-react";
import { useTabStore } from "../tabStore";
import { cn } from "~/lib/utils";
import { CATEGORY_ICON_MAP } from "./chat/CtfCategoryPicker";

export function TabBar() {
  const openTabs = useTabStore((s) => s.openTabs);
  const activeTabThreadId = useTabStore((s) => s.activeTabThreadId);
  const closeTab = useTabStore((s) => s.closeTab);

  if (openTabs.length === 0) return null;

  return (
    <div className="flex-shrink-0 overflow-x-auto border-b border-border">
      <div className="flex">
        {openTabs.map((tab) => {
          const isActive = tab.threadId === activeTabThreadId;
          const CategoryIcon = tab.ctfCategory ? CATEGORY_ICON_MAP[tab.ctfCategory] : null;

          return (
            <Link
              key={tab.threadId}
              to="/$threadId"
              params={{ threadId: tab.threadId }}
              className={cn(
                "group flex min-w-0 max-w-48 shrink-0 items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground",
                isActive && "bg-accent text-foreground",
              )}
              onMouseDown={(event) => {
                if (event.button === 1) {
                  event.preventDefault();
                  closeTab(tab.threadId);
                }
              }}
            >
              {CategoryIcon ? (
                <CategoryIcon
                  aria-hidden="true"
                  className="size-3.5 shrink-0 text-muted-foreground/70"
                />
              ) : null}
              <span className="min-w-0 flex-1 truncate">{tab.title}</span>
              <button
                type="button"
                className="shrink-0 rounded p-0.5 opacity-0 hover:bg-muted group-hover:opacity-100"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  closeTab(tab.threadId);
                }}
              >
                <XIcon aria-hidden="true" className="size-3" />
              </button>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
