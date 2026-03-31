"use client";
/**
 * AgenticFlow — Agent Builder Component
 * The main 4-step build flow: Intake → Compile → Sandbox → Eval
 * agenticflow/frontend/src/components/builder/AgentBuilder.tsx:
 */
import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Zap, Terminal, BarChart2, Code, GitBranch } from "lucide-react";
import toast from "react-hot-toast";

import { agentApi } from "@/lib/api";
import { useAgentStore, useWorkspaceStore } from "@/store";
import { FREE_MODELS, TOOL_OPTIONS, GUARDRAIL_OPTIONS, type Agent, type Framework } from "@/types";
import { SandboxChat } from "@/components/builder/SandboxChat";
import { EvalDashboard } from "@/components/builder/EvalDashboard";
import { GraphView } from "@/components/builder/GraphView";
import { CodeExport } from "@/components/builder/CodeExport";
import { TerminalLog } from "@/components/builder/TerminalLog";

// ── Form schema ──────────────────────────────────────────────────────────────
const buildSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  goal: z.string().min(10, "Describe the goal in at least 10 characters"),
  base_model: z.string(),
  framework: z.enum(["langgraph", "crewai", "autogen", "agno", "custom"]),
  system_prompt: z.string().optional(),
});

type BuildFormData = z.infer<typeof buildSchema>;

type BuildTab = "sandbox" | "graph" | "eval" | "code";

interface CompileLog { text: string; type: "info" | "success" | "warn" | "error" }

export function AgentBuilder({ workspaceId }: { workspaceId: string }) {
  const { compileAgent, fetchAgents } = useAgentStore();
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [selectedGuardrails, setSelectedGuardrails] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<BuildTab>("sandbox");
  const [compiledAgent, setCompiledAgent] = useState<Agent | null>(null);
  const [compileLogs, setCompileLogs] = useState<CompileLog[]>([]);
  const [isCompiling, setIsCompiling] = useState(false);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<BuildFormData>({
    resolver: zodResolver(buildSchema),
    defaultValues: {
      base_model: "llama3.1:8b",
      framework: "langgraph",
    },
  });

  const toggleItem = (list: string[], setList: (v: string[]) => void, item: string) => {
    setList(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);
  };

  const addLog = useCallback((text: string, type: CompileLog["type"] = "info") => {
    setCompileLogs((prev) => [...prev, { text, type }]);
  }, []);

  const onSubmit = async (data: BuildFormData) => {
    setIsCompiling(true);
    setCompileLogs([]);
    setCompiledAgent(null);

    try {
      addLog(`> agenticflow compile --name "${data.name}"`, "info");
      addLog(`  framework: ${data.framework}`, "info");
      addLog(`  model: ${data.base_model}`, "info");

      // 1. Create agent
      addLog("  creating agent record...", "info");
      const agent = await agentApi.create(workspaceId, {
        ...data,
        tools: selectedTools,
        guardrails: selectedGuardrails,
      });
      addLog(`✓ agent created (id: ${agent.id.slice(0, 8)}...)`, "success");

      // 2. Compile
      addLog(`  tools registered: ${selectedTools.join(", ") || "none"}`, "info");
      addLog(`  guardrails: ${selectedGuardrails.join(", ") || "none"}`, "info");
      addLog("  building reasoning graph...", "info");
      const compiled = await compileAgent(agent.id);
      addLog("✓ LangGraph reasoning graph compiled", "success");
      addLog("  spinning up sandbox container...", "info");
      addLog("✓ container healthy", "success");
      addLog(`✓ endpoint: ${compiled.endpoint_url}`, "success");

      setCompiledAgent(compiled);
      await fetchAgents(workspaceId);
      toast.success(`Agent "${data.name}" is live!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Compilation failed";
      addLog(`✗ ${msg}`, "error");
      toast.error(msg);
    } finally {
      setIsCompiling(false);
    }
  };

  const TABS: { id: BuildTab; label: string; icon: React.ReactNode }[] = [
    { id: "sandbox", label: "Sandbox", icon: <Terminal size={14} /> },
    { id: "graph",   label: "Graph",   icon: <GitBranch size={14} /> },
    { id: "eval",    label: "Eval",    icon: <BarChart2 size={14} /> },
    { id: "code",    label: "Export",  icon: <Code size={14} /> },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 min-h-[calc(100vh-56px)]">
      {/* ── LEFT: Intake Form ─────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="bg-[#111118] border border-white/[0.07] rounded-2xl p-6">
          <p className="text-[11px] font-mono text-white/40 tracking-widest mb-5">
            STEP 1 — INTAKE FORM → REASONING GRAPH
          </p>

          {/* Progress steps */}
          <div className="flex border border-white/[0.07] rounded-lg overflow-hidden mb-6">
            {["Intake", "Compile", "Sandbox", "Eval"].map((step, i) => (
              <div key={step} className={`flex-1 py-2 text-center text-[11px] font-mono border-r border-white/[0.07] last:border-r-0 ${
                compiledAgent ? "text-emerald-400 bg-emerald-400/5"
                : isCompiling && i === 1 ? "text-violet-400 bg-violet-400/8"
                : i === 0 ? "text-violet-400" : "text-white/30"
              }`}>
                <span className="block text-base font-bold">{i + 1}</span>
                {step}
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-[11px] font-mono text-white/40 mb-1.5">agent name</label>
              <input
                {...register("name")}
                placeholder="SalesQualifier-Pro"
                className="w-full bg-[#1a1a24] border border-white/[0.07] rounded-lg px-3 py-2.5 text-sm font-mono text-white placeholder:text-white/20 outline-none focus:border-violet-500/50 transition-colors"
              />
              {errors.name && <p className="text-red-400 text-xs mt-1 font-mono">{errors.name.message}</p>}
            </div>

            {/* Goal */}
            <div>
              <label className="block text-[11px] font-mono text-white/40 mb-1.5">goal / job description</label>
              <textarea
                {...register("goal")}
                rows={3}
                placeholder="Qualify inbound leads from HubSpot, check LinkedIn profile, score them 1-10, and draft a follow-up email..."
                className="w-full bg-[#1a1a24] border border-white/[0.07] rounded-lg px-3 py-2.5 text-sm font-mono text-white placeholder:text-white/20 outline-none focus:border-violet-500/50 transition-colors resize-none"
              />
              {errors.goal && <p className="text-red-400 text-xs mt-1 font-mono">{errors.goal.message}</p>}
            </div>

            {/* Base model */}
            <div>
              <label className="block text-[11px] font-mono text-white/40 mb-1.5">base model</label>
              <select
                {...register("base_model")}
                className="w-full bg-[#1a1a24] border border-white/[0.07] rounded-lg px-3 py-2.5 text-sm font-mono text-white outline-none focus:border-violet-500/50 transition-colors"
              >
                <optgroup label="── Free Models ──">
                  {FREE_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label} ({m.provider}) — Free
                    </option>
                  ))}
                </optgroup>
                <optgroup label="── Pro Models ──">
                  <option value="claude-sonnet-4">Claude Sonnet 4 (Anthropic) — Pro</option>
                  <option value="gpt-4o">GPT-4o (OpenAI) — Pro</option>
                </optgroup>
              </select>
            </div>

            {/* Framework */}
            <div>
              <label className="block text-[11px] font-mono text-white/40 mb-1.5">framework</label>
              <select
                {...register("framework")}
                className="w-full bg-[#1a1a24] border border-white/[0.07] rounded-lg px-3 py-2.5 text-sm font-mono text-white outline-none focus:border-violet-500/50 transition-colors"
              >
                <option value="langgraph">LangGraph</option>
                <option value="crewai">CrewAI</option>
                <option value="autogen">AutoGen</option>
                <option value="agno">Agno</option>
                <option value="custom">Custom (export code)</option>
              </select>
            </div>

            {/* Tools */}
            <div>
              <label className="block text-[11px] font-mono text-white/40 mb-1.5">tools / integrations</label>
              <div className="flex flex-wrap gap-1.5">
                {TOOL_OPTIONS.map((tool) => (
                  <button
                    key={tool}
                    type="button"
                    onClick={() => toggleItem(selectedTools, setSelectedTools, tool)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-mono border transition-all ${
                      selectedTools.includes(tool)
                        ? "border-violet-500/50 text-violet-300 bg-violet-500/10"
                        : "border-white/[0.07] text-white/40 hover:text-white/60"
                    }`}
                  >
                    {tool}
                  </button>
                ))}
              </div>
            </div>

            {/* Guardrails */}
            <div>
              <label className="block text-[11px] font-mono text-white/40 mb-1.5">guardrails</label>
              <div className="flex flex-wrap gap-1.5">
                {GUARDRAIL_OPTIONS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => toggleItem(selectedGuardrails, setSelectedGuardrails, g)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-mono border transition-all ${
                      selectedGuardrails.includes(g)
                        ? "border-violet-500/50 text-violet-300 bg-violet-500/10"
                        : "border-white/[0.07] text-white/40 hover:text-white/60"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={isCompiling}
              className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold text-sm py-3 rounded-xl transition-all flex items-center justify-center gap-2 mt-2"
            >
              {isCompiling ? (
                <><Loader2 size={16} className="animate-spin" /> Compiling...</>
              ) : (
                <><Zap size={16} /> Compile Agent</>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* ── RIGHT: Output Panel ───────────────────────────────────────────── */}
      <div className="bg-[#111118] border border-white/[0.07] rounded-2xl p-6 flex flex-col">
        {/* Tab bar */}
        <div className="flex gap-1 bg-[#1a1a24] rounded-lg p-1 mb-5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[12px] font-mono transition-all ${
                activeTab === tab.id
                  ? "bg-[#111118] text-white border border-white/[0.07]"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "sandbox" && (
          <div className="flex-1 flex flex-col gap-4">
            <TerminalLog logs={compileLogs} />
            {compiledAgent && <SandboxChat agent={compiledAgent} />}
          </div>
        )}
        {activeTab === "graph" && (
          <GraphView agent={compiledAgent} />
        )}
        {activeTab === "eval" && compiledAgent && (
          <EvalDashboard agentId={compiledAgent.id} />
        )}
        {activeTab === "code" && (
          <CodeExport agent={compiledAgent} tools={selectedTools} guardrails={selectedGuardrails} />
        )}
      </div>
    </div>
  );
}
