"use client";

import { useState } from "react";
import { TopBar } from "@/components/shared/TopBar";
import { PromptInput } from "@/components/builder/PromptInput";
import { GeneratedAssetsList } from "@/components/builder/GeneratedAssetsList";
import { FormPreview } from "@/components/builder/FormPreview";
import { RefineBar } from "@/components/builder/RefineBar";
import { mockGeneratedApp } from "@/data/mock-ai-responses";

const examples = [
  "Customer support desk",
  "Expense approval flow",
  "Inventory manager",
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
        title="The Intelligent Layer"
        breadcrumbs={[{ label: "AI Agent" }, { label: "Dev/Prod" }]}
      />

      <main className="pt-16 pb-32">
        {/* Hero input */}
        <section className="max-w-4xl mx-auto pt-20 pb-12 px-6">
          <div className="text-center mb-12">
            <h2 className="font-headline text-4xl font-extrabold text-white mb-4 tracking-tight">
              What kind of app do you want to build today?
            </h2>
            <p className="text-on-surface-variant font-medium">
              Describe your vision. AI will architect the tables, workflows, and
              interfaces.
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
                  title="Ticket Detail Preview"
                  subtitle="Mock interface based on generated schema."
                  aiInsight={mockGeneratedApp.aiInsight}
                />
              </div>
            </div>
          </section>
        )}

        {!generated && (
          <section className="px-8 text-center text-on-surface-variant text-sm">
            Try typing a prompt or clicking an example to preview the generated app.
          </section>
        )}
      </main>

      {generated && <RefineBar />}
    </>
  );
}
