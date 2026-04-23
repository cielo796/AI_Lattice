"use client";

import { create } from "zustand";
import type { User } from "@/types/user";
import {
  getCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
} from "@/lib/api/auth";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  login: async (email, password) => {
    set({ isLoading: true, error: null });

    try {
      const user = await loginRequest({ email, password });
      set({
        user,
        isAuthenticated: true,
        isLoading: false,
      });
      return true;
    } catch (error) {
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: error instanceof Error ? error.message : "ログインに失敗しました",
      });
      return false;
    }
  },
  logout: async () => {
    try {
      await logoutRequest();
    } finally {
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  },
  hydrate: async () => {
    set({ isLoading: true });

    try {
      const user = await getCurrentUser();
      set({
        user,
        isAuthenticated: Boolean(user),
        isLoading: false,
        error: null,
      });
    } catch (error) {
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: error instanceof Error ? error.message : "セッション確認に失敗しました",
      });
    }
  },
  clearError: () => set({ error: null }),
}));
