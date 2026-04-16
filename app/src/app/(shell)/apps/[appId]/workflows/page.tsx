"use client";

import { TopBar } from "@/components/shared/TopBar";
import { Button } from "@/components/shared/Button";
import { Icon } from "@/components/shared/Icon";
import { AISidebar } from "@/components/ai/AISidebar";
import { WorkflowCanvas } from "@/components/workflow/WorkflowCanvas";
import { WorkflowToolbar } from "@/components/workflow/WorkflowToolbar";
import { AICommandBar } from "@/components/workflow/AICommandBar";

export default function WorkflowEditorPage() {
  return (
    <>
      <TopBar
        breadcrumbs={[{ label: "ダッシュボード" }, { label: "ワークフロー自動化エディタ" }]}
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

      <main className="flex min-h-[calc(100vh-4rem)] flex-col pt-16 2xl:h-[calc(100vh-4rem)] 2xl:flex-row">
        {/* Left: Canvas */}
        <section className="relative h-[60vh] md:h-[70vh] 2xl:h-auto 2xl:flex-1">
          <WorkflowToolbar />
          <WorkflowCanvas />
          <AICommandBar />
        </section>

        {/* Right: AI Assistant */}
        <AISidebar className="border-t border-outline-variant/20 2xl:h-auto 2xl:w-80 2xl:border-l 2xl:border-t-0">
          <div className="bg-emerald-950/30 border border-primary/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="auto_awesome" size="sm" className="text-primary" filled />
              <span className="text-xs font-bold text-primary uppercase tracking-wider">
                改善提案
              </span>
            </div>
            <p className="text-xs text-on-surface leading-relaxed mb-3">
              プライマリトリガーに接続するマネージャー承認ノードの下書きを作成しました。
              これにより、Slack通知の前に高額レコードが必ず確認されます。
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary">
                変更を適用
              </Button>
              <button className="w-8 h-8 rounded-lg bg-surface-container-high text-on-surface-variant hover:text-white flex items-center justify-center">
                <Icon name="close" size="sm" />
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="bg-surface-container-high rounded-xl p-3 text-xs text-on-surface ml-6">
              優先度がクリティカルの場合、マネージャー承認ステップを追加
            </div>
            <div className="bg-surface-container rounded-xl p-3 text-xs text-on-surface-variant">
              ワークフローのコンテキストを分析中... 「条件分岐」と「通知」の間が
              最適な挿入ポイントであることを特定しました。ノードを生成しています。
            </div>
          </div>
        </AISidebar>
      </main>
    </>
  );
}
