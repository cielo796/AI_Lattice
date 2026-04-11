"use client";

import { useRouter } from "next/navigation";
import { Icon } from "@/components/shared/Icon";
import { Button } from "@/components/shared/Button";

export function RefineBar() {
  const router = useRouter();

  return (
    <footer className="fixed bottom-0 right-0 left-64 h-24 glass-effect flex items-center px-12 z-50">
      <div className="flex-1 max-w-4xl mx-auto flex items-center gap-6">
        <div className="flex-1 relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant text-lg">
            edit_note
          </span>
          <input
            className="w-full bg-surface-container-high border-none rounded-full py-3 pl-12 pr-6 text-sm text-white placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="AIで調整（例：SLA状態というステータス項目を追加）"
          />
        </div>
        <div className="flex gap-4">
          <Button
            variant="primary"
            size="lg"
            onClick={() => router.push("/apps/app-001/tables")}
          >
            承認してビルド
            <Icon name="rocket_launch" size="sm" />
          </Button>
        </div>
      </div>
    </footer>
  );
}
