"use client";

import { create } from "zustand";

export type ToastVariant = "success" | "error" | "info";

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastInput {
  title: string;
  description?: string;
  variant?: ToastVariant;
  durationMs?: number;
}

interface ToastState {
  toasts: ToastMessage[];
  pushToast: (toast: ToastInput) => string;
  removeToast: (toastId: string) => void;
}

let toastSequence = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  pushToast: ({
    title,
    description,
    variant = "info",
    durationMs = 4000,
  }) => {
    const id = `toast-${Date.now()}-${toastSequence++}`;

    set((state) => ({
      toasts: [...state.toasts, { id, title, description, variant }].slice(-4),
    }));

    if (durationMs > 0) {
      globalThis.setTimeout(() => {
        useToastStore.getState().removeToast(id);
      }, durationMs);
    }

    return id;
  },
  removeToast: (toastId) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== toastId),
    })),
}));
