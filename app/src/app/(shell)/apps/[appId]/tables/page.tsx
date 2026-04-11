"use client";

import { useState } from "react";
import Link from "next/link";
import { TopBar } from "@/components/shared/TopBar";
import { Icon } from "@/components/shared/Icon";
import { Button } from "@/components/shared/Button";
import { Badge } from "@/components/shared/Badge";
import { AISidebar } from "@/components/ai/AISidebar";
import { mockTables, mockFields } from "@/data/mock-tables";
import { cn } from "@/lib/cn";

const fieldTypeIcons: Record<string, { icon: string; label: string; variant: string }> = {
  text: { icon: "text_fields", label: "テキスト", variant: "default" },
  textarea: { icon: "notes", label: "複数行テキスト", variant: "default" },
  number: { icon: "numbers", label: "数値", variant: "info" },
  date: { icon: "calendar_today", label: "日付", variant: "info" },
  datetime: { icon: "schedule", label: "日時", variant: "info" },
  boolean: { icon: "toggle_on", label: "真偽値", variant: "default" },
  select: { icon: "list", label: "選択肢", variant: "warning" },
  user_ref: { icon: "person", label: "ユーザー参照", variant: "info" },
  master_ref: { icon: "link", label: "マスタ参照", variant: "info" },
  file: { icon: "attach_file", label: "ファイル", variant: "default" },
  ai_generated: { icon: "auto_awesome", label: "AI生成", variant: "ai" },
  calculated: { icon: "functions", label: "計算", variant: "warning" },
};

const tableNameJa: { [code: string]: string } = {
  tickets: "チケット",
  customers: "顧客",
  slas: "SLA",
};

export default function TableDesignerPage() {
  const [activeTableId, setActiveTableId] = useState("tbl-001");
  const activeFields = mockFields.filter((f) => f.tableId === activeTableId);
  const activeTable = mockTables.find((t) => t.id === activeTableId);

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: "ダッシュボード" },
          { label: "サポートデスク" },
          { label: "テーブル" },
        ]}
        actions={
          <>
            <Button variant="ghost" size="md">
              <Icon name="visibility" size="sm" />
              プレビュー
            </Button>
            <Button variant="primary" size="md">
              <Icon name="rocket_launch" size="sm" />
              デプロイ
            </Button>
          </>
        }
      />

      <main className="pt-16 h-screen flex">
        {/* Left: Tables List */}
        <aside className="w-64 bg-surface-container p-6 overflow-y-auto">
          <div className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-4">
            テーブル一覧
          </div>
          <div className="space-y-2">
            {mockTables.map((table) => (
              <button
                key={table.id}
                onClick={() => setActiveTableId(table.id)}
                className={cn(
                  "w-full text-left p-3 rounded-lg flex items-center justify-between transition-colors",
                  activeTableId === table.id
                    ? "bg-primary/10 text-primary font-bold"
                    : "text-on-surface-variant hover:bg-surface-container-high"
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon name="table_chart" size="sm" />
                  <span className="text-sm">{tableNameJa[table.code] ?? table.name}</span>
                </div>
                {activeTableId === table.id && (
                  <Badge variant="success" className="text-[9px]">
                    選択中
                  </Badge>
                )}
              </button>
            ))}
          </div>

          <button className="mt-4 w-full p-3 border-2 border-dashed border-outline-variant/40 rounded-lg text-on-surface-variant hover:text-primary hover:border-primary/40 text-sm transition-colors">
            <Icon name="add" size="sm" /> 新しいテーブル
          </button>

          {/* AI Insights */}
          <div className="mt-8 bg-emerald-950/30 border border-primary/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="auto_awesome" size="sm" className="text-primary" filled />
              <span className="text-xs font-bold text-primary uppercase tracking-wider">
                AIインサイト
              </span>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              チケット量を分析中... 「バグ報告」カテゴリで件数が急増しています。
              重要度インデックスの追加を検討してください。
            </p>
          </div>
        </aside>

        {/* Center: Field Editor */}
        <section className="flex-1 overflow-y-auto p-10 bg-surface">
          <div className="max-w-3xl">
            <h2 className="font-headline text-3xl font-bold text-white mb-2">
              テーブル：{tableNameJa[activeTable?.code ?? ""] ?? activeTable?.name}
            </h2>
            <p className="text-sm text-on-surface-variant mb-8">
              サポートチケットのデータ構造と属性、ロジックを定義します。
            </p>

            {/* Smart suggestion */}
            <div className="bg-emerald-950/30 border border-primary/20 rounded-xl p-4 mb-8">
              <div className="flex items-start gap-3">
                <Icon
                  name="auto_awesome"
                  className="text-primary mt-0.5"
                  size="md"
                  filled
                />
                <div className="flex-1">
                  <div className="text-xs font-bold text-primary uppercase tracking-wider mb-1">
                    スマート提案
                  </div>
                  <p className="text-sm text-on-surface">
                    AIはアプリの説明に基づいて{" "}
                    <span className="text-primary font-bold">
                      [インシデント優先度]
                    </span>{" "}
                    フィールドの追加を提案しています。
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="secondary">
                      適用
                    </Button>
                    <Button size="sm" variant="ghost">
                      閉じる
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Field Header */}
            <div className="grid grid-cols-[2fr_1fr_80px] gap-4 px-4 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              <div>フィールド名</div>
              <div>型</div>
              <div></div>
            </div>

            {/* Field List */}
            <div className="space-y-2">
              {activeFields.map((field) => {
                const typeMeta = fieldTypeIcons[field.fieldType] ?? {
                  icon: "help",
                  label: field.fieldType,
                  variant: "default",
                };
                return (
                  <div
                    key={field.id}
                    className="grid grid-cols-[2fr_1fr_80px] gap-4 items-center p-4 bg-surface-container rounded-lg hover:bg-surface-container-high transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "font-mono text-sm",
                          field.fieldType === "ai_generated"
                            ? "text-primary font-bold"
                            : "text-on-surface"
                        )}
                      >
                        {field.name}
                      </span>
                      {field.required && (
                        <span className="text-error text-xs">*</span>
                      )}
                    </div>
                    <div>
                      <Badge
                        variant={typeMeta.variant as "default" | "success" | "warning" | "error" | "info" | "ai"}
                      >
                        {field.fieldType === "ai_generated" && (
                          <Icon name="auto_awesome" size="sm" filled />
                        )}
                        {typeMeta.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="w-7 h-7 rounded hover:bg-surface-container-highest flex items-center justify-center text-on-surface-variant">
                        <Icon name="edit" size="sm" />
                      </button>
                      <button className="w-7 h-7 rounded hover:bg-error/10 hover:text-error flex items-center justify-center text-on-surface-variant">
                        <Icon name="delete" size="sm" />
                      </button>
                    </div>
                  </div>
                );
              })}

              <button className="w-full p-4 border-2 border-dashed border-outline-variant/40 rounded-lg text-on-surface-variant hover:text-primary hover:border-primary/40 text-sm transition-colors flex items-center justify-center gap-2">
                <Icon name="add" size="sm" />
                クリックして新しいフィールドを追加
              </button>
            </div>

            <div className="mt-10 flex justify-end gap-3">
              <Link href={`/apps/app-001/workflows`}>
                <Button variant="ghost" size="md">
                  次へ：ワークフロー
                  <Icon name="arrow_forward" size="sm" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Right: AI Sidebar */}
        <AISidebar>
          <div>
            <div className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2">
              AI サマリー
            </div>
            <p className="text-xs text-on-surface leading-relaxed mb-4">
              現在{" "}
              <span className="text-primary font-bold">チケット</span>{" "}
              スキーマを編集中です。4つのコアフィールド + 1つのAI生成感情フィールド。
            </p>
          </div>

          <div>
            <div className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2">
              クイックアクション
            </div>
            <div className="space-y-2">
              <button className="w-full text-left p-3 bg-surface-container-high rounded-lg text-xs text-on-surface hover:bg-surface-container-highest transition-colors">
                サンプルデータを生成
              </button>
              <button className="w-full text-left p-3 bg-surface-container-high rounded-lg text-xs text-on-surface hover:bg-surface-container-highest transition-colors">
                外部ソースと連携
              </button>
            </div>
          </div>

          <div>
            <div className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2">
              モデル学習ステータス
            </div>
            <div className="bg-surface-container-high rounded-lg p-3">
              <div className="flex justify-between text-xs text-on-surface-variant mb-2">
                <span>感情モデル</span>
                <span className="text-primary font-bold">82%</span>
              </div>
              <div className="h-1.5 bg-surface-container rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: "82%" }} />
              </div>
            </div>
          </div>
        </AISidebar>
      </main>
    </>
  );
}
