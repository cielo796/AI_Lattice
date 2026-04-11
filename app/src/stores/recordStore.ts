"use client";

import { create } from "zustand";
import type { AppRecord } from "@/types/record";
import { mockRecords } from "@/data/mock-records";

interface RecordState {
  records: AppRecord[];
  selectedRecord: AppRecord | null;
  selectRecord: (record: AppRecord | null) => void;
}

export const useRecordStore = create<RecordState>((set) => ({
  records: mockRecords,
  selectedRecord: mockRecords[0],
  selectRecord: (record) => set({ selectedRecord: record }),
}));
