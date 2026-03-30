"use client";
import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { FREE_MODELS } from "@/types";

const ALL_MODELS = [
  ...FREE_MODELS.map((m) => ({ ...m, category: "free" })),
  { id: "claude-sonnet-4", label: "Claude Sonnet 4",  provider: "Anthropic", tags: ["pro", "vision"] as string[], category: "pro" },
  { id: "gpt-4o",          label: "GPT-4o",           provider: "OpenAI",    tags: ["pro", "vision"] as string[], category: "pro" },
  { id: "gpt-4o-mini",     label: "GPT-4o Mini",      provider: "OpenAI",    tags: ["pro", "fast"] as string[],   category: "pro" },
];

const TAG_STYLE: Record<string, string> = {
  free:       "border-emerald-500/30 text-emerald-400 bg-emerald-500/7",
  reasoning:  "border-violet-500/30 text-violet-300 bg-violet-500/7",
  vision:     "border-amber-500/30 text-amber-400 bg-amber-500/7",
  fast:       "border-sky-500/30 text-sky-400 bg-sky-500/7",
  pro:        "border-amber-500/30 text-amber-400 bg-amber-500/7",
  multilingual:"border-pink-500/30 text-pink-300 bg-pink-500/7",
  powerful:   "border-violet-500/30 text-violet-300 bg-violet-500/7",
  efficient:  "border-teal-500/30 text-teal-400 bg-teal-500/7",
  lean:       "border-gray-500/30 text-gray-400 bg-gray-500/7",
  edge:       "border-sky-500/30 text-sky-400 bg-sky-500/7",
};

const PROVIDER_LOGOS: Record<string, { bg: string; text: string; label: string }> = {
  Groq:       { bg: "bg-emerald-500/10", text: "text-emerald-400", label: "GQ" },
  Ollama:     { bg: "bg-violet-500/10",  text: "text-violet-300",  label: "OL" },
  Anthropic:  { bg: "bg-amber-500/10",   text: "text-amber-400",   label: "AN" },
  OpenAI:     { bg: "bg-emerald-500/10", text: "text-emerald-400", label: "OA" },
};

export default function ModelsPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "free" | "reasoning" | "pro">("all");

  const filtered = ALL_MODELS.filter((m) => {
    if (filter === "all") return true;
    if (filter === "free") return m.tags.includes("free");
    if (filter === "reasoning") return m.tags.includes("reasoning");
    if (filter === "pro") return m.category === "pro";
    return true;
  });

  return (
    <div className="p-5 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Model Registry</h1>
          <p className="text-white/30 font-mono text-xs mt-1">{ALL_MODELS.length} models · framework-agnostic · export anywhere</p>
        </div>
        {selected && (
          <Link href="/builder" className="flex items-center gap-2 bg-accent hover:bg-accent-light text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-all">
            Build with {ALL_MODELS.find((m) => m.id === selected)?.label} →
          </Link>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {(["all", "free", "reasoning", "pro"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all border ${
              filter === f
                ? "bg-accent/10 border-accent/40 text-accent-light"
                : "border-white/[0.07] text-white/30 hover:text-white/60"
            }`}>
            {f}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((model) => {
          const logo = PROVIDER_LOGOS[model.provider] ?? { bg: "bg-white/5", text: "text-white/50", label: "??" };
          const isSelected = selected === model.id;
          return (
            <button
              key={model.id}
              onClick={() => setSelected(isSelected ? null : model.id)}
              className={`text-left bg-bg-secondary border rounded-2xl p-5 transition-all hover:border-accent/30 group ${
                isSelected ? "border-accent/60 bg-accent/5" : "border-white/[0.07]"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl ${logo.bg} flex items-center justify-center text-xs font-bold font-mono ${logo.text}`}>
                    {logo.label}
                  </div>
                  <div>
                    <div className="font-bold text-sm">{model.label}</div>
                    <div className="text-[11px] font-mono text-white/30">{model.provider}</div>
                  </div>
                </div>
                {isSelected && <Check size={16} className="text-accent-light flex-shrink-0" />}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {model.tags.map((tag) => (
                  <span key={tag} className={`text-[10px] font-mono px-2 py-0.5 rounded-md border ${TAG_STYLE[tag] ?? "border-white/[0.07] text-white/30"}`}>
                    {tag}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* Free model setup guide */}
      <div className="mt-8 bg-bg-secondary border border-white/[0.07] rounded-2xl p-6">
        <h3 className="font-bold mb-4 text-sm">Running Free Models Locally</h3>
        <div className="space-y-3 font-mono text-xs text-white/50">
          <div>
            <span className="text-white/30"># Option 1: Ollama (fully local, no API key)</span>
            <pre className="mt-1 bg-black/30 rounded-lg px-4 py-3 text-emerald-400">
{`brew install ollama
ollama pull llama3.1:8b
ollama pull deepseek-r1:7b
ollama serve`}
            </pre>
          </div>
          <div>
            <span className="text-white/30"># Option 2: Groq API (free tier, very fast)</span>
            <pre className="mt-1 bg-black/30 rounded-lg px-4 py-3 text-violet-300">
{`# Get free API key at groq.com
GROQ_API_KEY=gsk_... # add to .env`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
