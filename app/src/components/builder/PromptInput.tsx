"use client";

import { Icon } from "@/components/shared/Icon";

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  examples?: string[];
  onExampleClick?: (ex: string) => void;
}

export function PromptInput({
  value,
  onChange,
  onSubmit,
  examples = [],
  onExampleClick,
}: PromptInputProps) {
  return (
    <div className="relative group">
      <div className="absolute -inset-1 rounded-2xl bg-tertiary-container/40 opacity-60 blur transition duration-500 group-hover:opacity-100 group-focus-within:opacity-100" />
      <div className="relative rounded-xl border border-outline-variant bg-surface p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)]">
        <div className="flex items-center gap-4 mb-4">
          <Icon name="psychology" className="text-primary" filled />
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSubmit?.()}
            className="w-full bg-transparent border-none focus:outline-none text-lg font-body placeholder:text-on-surface-muted text-on-surface"
            placeholder="例：エスカレーションフロー付きのカスタマーサポート問い合わせ管理システム..."
          />
        </div>
        {examples.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-4 border-t border-outline-variant">
            <span className="text-[11px] font-semibold text-on-surface-muted uppercase tracking-wider mr-2 py-1.5">
              例：
            </span>
            {examples.map((ex) => (
              <button
                key={ex}
                onClick={() => onExampleClick?.(ex)}
                className="px-3 py-1.5 bg-surface-container-high hover:bg-primary-container hover:text-on-primary-container rounded-full text-xs font-medium text-on-surface transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
