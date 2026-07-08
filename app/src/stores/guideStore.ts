"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { GUIDE_STORAGE_KEY } from "@/lib/guide-registry";

interface GuideState {
  activeTourId: string | null;
  stepIndex: number;
  isOpen: boolean;
  completedTourIds: string[];
  promptedTourIds: string[];
  dismissedTourIds: string[];
  startTour: (tourId: string) => void;
  setStepIndex: (stepIndex: number) => void;
  closeTour: () => void;
  completeTour: (tourId: string) => void;
  skipTour: (tourId: string) => void;
  markTourPrompted: (tourId: string) => void;
}

function appendUnique(items: string[], item: string) {
  return items.includes(item) ? items : [...items, item];
}

export const useGuideStore = create<GuideState>()(
  persist(
    (set) => ({
      activeTourId: null,
      stepIndex: 0,
      isOpen: false,
      completedTourIds: [],
      promptedTourIds: [],
      dismissedTourIds: [],
      startTour: (tourId) =>
        set({
          activeTourId: tourId,
          stepIndex: 0,
          isOpen: true,
        }),
      setStepIndex: (stepIndex) => set({ stepIndex }),
      closeTour: () =>
        set({
          activeTourId: null,
          stepIndex: 0,
          isOpen: false,
        }),
      completeTour: (tourId) =>
        set((state) => ({
          activeTourId: null,
          stepIndex: 0,
          isOpen: false,
          completedTourIds: appendUnique(state.completedTourIds, tourId),
        })),
      skipTour: (tourId) =>
        set((state) => ({
          activeTourId: null,
          stepIndex: 0,
          isOpen: false,
          dismissedTourIds: appendUnique(state.dismissedTourIds, tourId),
        })),
      markTourPrompted: (tourId) =>
        set((state) => ({
          promptedTourIds: appendUnique(state.promptedTourIds, tourId),
        })),
    }),
    {
      name: GUIDE_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        completedTourIds: state.completedTourIds,
        promptedTourIds: state.promptedTourIds,
        dismissedTourIds: state.dismissedTourIds,
      }),
    }
  )
);
