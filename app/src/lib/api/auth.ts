import type { User } from "@/types/user";
import { ApiError, apiFetch } from "@/lib/api/client";

interface AuthResponse {
  user: User;
}

interface LoginInput {
  email: string;
  password: string;
}

export async function login(input: LoginInput) {
  const response = await apiFetch<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return response.user;
}

export async function logout() {
  await apiFetch<{ success: boolean }>("/api/auth/logout", {
    method: "POST",
  });
}

export async function getCurrentUser() {
  try {
    const response = await apiFetch<AuthResponse>("/api/auth/me");
    return response.user;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }

    throw error;
  }
}
