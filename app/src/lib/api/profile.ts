import { apiFetch } from "@/lib/api/client";
import type { User } from "@/types/user";

export interface UpdateProfileInput {
  name: string;
  avatarUrl?: string;
}

export function getProfile() {
  return apiFetch<User>("/api/settings/profile");
}

export function updateProfile(input: UpdateProfileInput) {
  return apiFetch<User>("/api/settings/profile", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
