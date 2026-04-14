"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";

export function AuthBootstrap() {
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return null;
}
