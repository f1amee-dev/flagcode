import { type CtfCategory, type ThreadId } from "@flagcode/contracts";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface TabInfo {
  threadId: ThreadId;
  title: string;
  projectId: string;
  ctfCategory?: CtfCategory | null;
}

interface TabStoreState {
  openTabs: TabInfo[];
  activeTabThreadId: ThreadId | null;
  openTab: (tab: TabInfo) => void;
  closeTab: (threadId: ThreadId) => void;
  setActiveTab: (threadId: ThreadId) => void;
  updateTab: (threadId: ThreadId, patch: Partial<Omit<TabInfo, "threadId">>) => void;
  cleanupTabs: (existingThreadIds: Set<string>) => void;
}

export const useTabStore = create<TabStoreState>()(
  persist(
    (set) => ({
      openTabs: [],
      activeTabThreadId: null,

      openTab: (tab) =>
        set((state) => {
          const existingIndex = state.openTabs.findIndex((t) => t.threadId === tab.threadId);
          if (existingIndex >= 0) {
            const openTabs = state.openTabs.map((t, i) =>
              i === existingIndex ? { ...t, ...tab } : t,
            );
            return { openTabs, activeTabThreadId: tab.threadId };
          }
          return {
            openTabs: [...state.openTabs, tab],
            activeTabThreadId: tab.threadId,
          };
        }),

      closeTab: (threadId) =>
        set((state) => {
          const index = state.openTabs.findIndex((t) => t.threadId === threadId);
          if (index < 0) return state;

          const openTabs = state.openTabs.filter((t) => t.threadId !== threadId);
          let activeTabThreadId = state.activeTabThreadId;

          if (activeTabThreadId === threadId) {
            const nextTab = openTabs[index] ?? openTabs[index - 1] ?? null;
            activeTabThreadId = nextTab?.threadId ?? null;
          }

          return { openTabs, activeTabThreadId };
        }),

      setActiveTab: (threadId) => set({ activeTabThreadId: threadId }),

      updateTab: (threadId, patch) =>
        set((state) => {
          const index = state.openTabs.findIndex((t) => t.threadId === threadId);
          if (index < 0) return state;

          const openTabs = state.openTabs.map((t, i) => (i === index ? { ...t, ...patch } : t));
          return { openTabs };
        }),

      cleanupTabs: (existingThreadIds) =>
        set((state) => {
          const openTabs = state.openTabs.filter((t) => existingThreadIds.has(t.threadId));
          if (openTabs.length === state.openTabs.length) return state;

          const activeTabThreadId =
            state.activeTabThreadId && existingThreadIds.has(state.activeTabThreadId)
              ? state.activeTabThreadId
              : (openTabs[0]?.threadId ?? null);

          return { openTabs, activeTabThreadId };
        }),
    }),
    {
      name: "flagcode:open-tabs:v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        openTabs: state.openTabs,
        activeTabThreadId: state.activeTabThreadId,
      }),
    },
  ),
);
