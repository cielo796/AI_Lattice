"use client";

import { useState } from "react";
import { TopBar } from "@/components/shared/TopBar";
import { PromptInput } from "@/components/builder/PromptInput";
import { GeneratedAssetsList } from "@/components/builder/GeneratedAssetsList";
import { FormPreview } from "@/components/builder/FormPreview";
import { RefineBar } from "@/components/builder/RefineBar";
import { mockGeneratedApp } from "@/data/mock-ai-responses";

const examples = [
  "カスタマーサポートデスク",
  "経費精算フロー",
  "在庫管理",
];

export default function NewAIAppPage() {
  const [prompt, setPrompt] = useState("");
  const [generated, setGenerated] = useState(false);
  const [activeTableCode, setActiveTableCode] = useState<string>(
    mockGeneratedApp.tables[0].code
  );

  const handleGenerate = () => setGenerated(true);

  return (
    <>
      <TopBar
        title="AI Lattice"
        breadcrumbs={[{ label: "AIエージェント" }, { label: "開発/本番" }]}
      />

      <main className="pt-16 pb-32">
        {/* Hero input */}
        <section className="max-w-4xl mx-auto pt-20 pb-12 px-6">
          <div className="text-center mb-12">
            <h2 className="font-headline text-4xl font-extrabold text-white mb-4 tracking-tight">
              今日はどんなアプリを作りますか？
            </h2>
            <p className="text-on-surface-variant font-medium">
              業務の内容を自然言語で記述してください。AIがテーブル・ワークフロー・画面を自動設計します。
            </p>
          </div>
          <PromptInput
            value={prompt}
            onChange={setPrompt}
            onSubmit={handleGenerate}
            examples={examples}
            onExampleClick={(ex) => {
              setPrompt(ex);
              setGenerated(true);
            }}
          />
        </section>

        {/* Preview section */}
        {generated && (
          <section className="px-8">
            <div className="bg-surface-container-low rounded-xl overflow-hidden min-h-[600px] flex flex-col md:flex-row">
              <aside className="w-full md:w-80 bg-surface-container p-6">
                <GeneratedAssetsList
                  app={mockGeneratedApp}
                  activeTableCode={activeTableCode}
                  onSelectTable={setActiveTableCode}
                />
              </aside>
              <div className="flex-1 p-8 flex flex-col items-center justify-start bg-surface/20">
                <FormPreview
                  title="チケット詳細プレビュー"
                  subtitle="生成されたスキーマに基づくモックインターフェース"
                  aiInsight={mockGeneratedApp.aiInsight}
                />
              </div>
            </div>
          </section>
        )}

        {!generated && (
          <section className="px-8 text-center text-on-surface-variant text-sm">
            プロンプトを入力するか、例示チップをクリックして生成結果を確認してください。
          </section>
        )}
      </main>

      {generated && <RefineBar />}
    </>
  );
}
