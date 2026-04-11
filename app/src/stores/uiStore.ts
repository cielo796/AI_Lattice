"use client";

import { create } from "zustand";

interface UIState {
  sidebarOpen: boolean;
  aiSidebarOpen: boolean;
  activeAITab: "summary" | "actions" | "context";
  toggleSidebar: () => void;
  toggleAISidebar: () => void;
  setActiveAITab: (tab: "summary" | "actions" | "context") => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  aiSidebarOpen: true,
  activeAITab: "summary",
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleAISidebar: () => set((s) => ({ aiSidebarOpen: !s.aiSidebarOpen })),
  setActiveAITab: (tab) => set({ activeAITab: tab }),
}));
