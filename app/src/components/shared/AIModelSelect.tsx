import type { SelectHTMLAttributes } from "react";
import { AI_MODEL_OPTIONS, isKnownAIModel } from "@/lib/ai-models";

interface AIModelSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "value" | "onChange"> {
  value: string;
  onChange: (value: string) => void;
  allowDefault?: boolean;
}

export function AIModelSelect({ value, onChange, allowDefault = false, className, ...props }: AIModelSelectProps) {
  return (
    <select
      {...props}
      className={className ?? "w-full rounded-md border border-outline bg-surface px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {allowDefault && <option value="">テンプレート / 管理設定を使用</option>}
      {value && !isKnownAIModel(value) && <option value={value}>{value}（既存のカスタム設定）</option>}
      {AI_MODEL_OPTIONS.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}
    </select>
  );
}
