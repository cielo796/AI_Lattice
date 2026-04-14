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
      <div className="absolute -inset-1 bg-gradient-to-r from-primary to-primary-container opacity-20 rounded-2xl blur group-hover:opacity-40 transition duration-500" />
      <div className="relative bg-surface-container rounded-xl p-6 shadow-xl">
        <div className="flex items-center gap-4 mb-4">
          <Icon name="psychology" className="text-primary" filled />
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSubmit?.()}
            className="w-full bg-transparent border-none focus:outline-none text-lg font-body placeholder:text-on-surface-variant/50 text-white"
            placeholder="例：エスカレーションフロー付きのカスタマーサポート問い合わせ管理システム..."
          />
        </div>
        {examples.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-4 border-t border-outline-variant/30">
            <span className="text-xs font-label font-semibold text-on-surface-variant uppercase tracking-widest mr-2 py-1.5">
              例：
            </span>
            {examples.map((ex) => (
              <button
                key={ex}
                onClick={() => onExampleClick?.(ex)}
                className="px-3 py-1.5 bg-surface-container-high hover:bg-surface-container-highest rounded-full text-xs font-medium text-on-surface transition-colors"
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
