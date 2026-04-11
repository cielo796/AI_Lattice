"use client";

import { create } from "zustand";
import type { App, AppTable, AppField } from "@/types/app";
import { mockApps } from "@/data/mock-apps";
import { mockTables, mockFields } from "@/data/mock-tables";

interface AppState {
  apps: App[];
  currentApp: App | null;
  tables: AppTable[];
  currentTable: AppTable | null;
  fields: AppField[];
  setCurrentApp: (app: App | null) => void;
  setCurrentTable: (table: AppTable | null) => void;
  getFieldsForTable: (tableId: string) => AppField[];
  getTablesForApp: (appId: string) => AppTable[];
}

export const useAppStore = create<AppState>((set, get) => ({
  apps: mockApps,
  currentApp: mockApps[0],
  tables: mockTables,
  currentTable: mockTables[0],
  fields: mockFields,
  setCurrentApp: (app) => set({ currentApp: app }),
  setCurrentTable: (table) => set({ currentTable: table }),
  getFieldsForTable: (tableId) =>
    get().fields.filter((f) => f.tableId === tableId),
  getTablesForApp: (appId) =>
    get().tables.filter((t) => t.appId === appId),
}));
