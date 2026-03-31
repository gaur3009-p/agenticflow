"use client";
/**
 * AgenticFlow — Builder Sub-Components
 * SandboxChat | TerminalLog | EvalDashboard | GraphView | CodeExport
 *agenticflow/frontend/src/components/builder/index.ts:
 */
import { useState, useRef, useEffect } from "react";
import { Send, Copy, Check, RefreshCw, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { agentApi, evalApi } from "@/lib/api";
import type { Agent, EvalRun } from "@/types";


// ── Terminal Log ─────────────────────────────────────────────────────────────
interface LogLine { text: string; type: "info" | "success" | "warn" | "error" }

export function TerminalLog({ logs }: { logs: LogLine[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.scrollTo(0, ref.current.scrollHeight); }, [logs]);

  const colorMap = { info: "text-white/40", success: "text-emerald-400", warn: "text-amber-400", error: "text-red-400" };

  return (
    <div className="bg-[#0a0a0f] border border-white/[0.07] rounded-xl p-4 font-mono text-[12px] min-h-[160px] max-h-[220px] overflow-y-auto" ref={ref}>
      {logs.length === 0 ? (
        <span className="text-white/20">// Waiting for compilation...</span>
      ) : (
        logs.map((l, i) => (
          <div key={i} className={`${colorMap[l.type]} leading-6`}>{l.text}</div>
        ))
      )}
    </div>
  );
}


// ── Sandbox Chat ─────────────────────────────────────────────────────────────
interface ChatMessage { role: "user" | "agent" | "sys"; content: string }

export function SandboxChat({ agent }: { agent: Agent }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "sys", content: `Agent "${agent.name}" is live. Send a test message.` }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { ref.current?.scrollTo(0, ref.current.scrollHeight); }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((m) => [...m, { role: "user", content: userMsg }]);
    setLoading(true);
    try {
      const res = await agentApi.run(agent.id, { message: userMsg });
      setMessages((m) => [...m, { role: "agent", content: res.output }]);
    } catch {
      setMessages((m) => [...m, { role: "sys", content: "Error — check your API connection." }]);
    } finally {
      setLoading(false);
    }
  };

  const colorMap = { user: "text-violet-300", agent: "text-emerald-300", sys: "text-white/30" };
  const prefixMap = { user: "USER ›", agent: "AGENT ›", sys: "SYS ›" };

  return (
    <div>
      <p className="text-[11px] font-mono text-white/40 tracking-widest mb-3">TEST YOUR AGENT</p>
      <div ref={ref} className="bg-[#0a0a0f] border border-white/[0.07] rounded-xl p-4 font-mono text-[12px] min-h-[140px] max-h-[180px] overflow-y-auto space-y-1.5 mb-3">
        {messages.map((m, i) => (
          <div key={i} className={colorMap[m.role]}>
            <span className="font-medium">{prefixMap[m.role]}</span>{" "}{m.content}
          </div>
        ))}
        {loading && <div className="text-white/20 animate-pulse">thinking...</div>}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Test your agent..."
          className="flex-1 bg-[#1a1a24] border border-white/[0.07] rounded-lg px-3 py-2 text-sm font-mono text-white placeholder:text-white/20 outline-none focus:border-violet-500/50 transition-colors"
        />
        <button onClick={send} disabled={loading} className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white px-3 py-2 rounded-lg transition-all">
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}


// ── Eval Dashboard ───────────────────────────────────────────────────────────
export function EvalDashboard({ agentId }: { agentId: string }) {
  const [evalRun, setEvalRun] = useState<EvalRun | null>(null);
  const [loading, setLoading] = useState(false);

  const runEval = async () => {
    setLoading(true);
    try {
      const run = await evalApi.triggerRun(agentId);
      // Poll for completion (in production, use WebSocket or polling)
      setEvalRun(run);
      toast.success("Eval triggered — results will appear when complete");
    } catch (e) {
      toast.error("Eval failed");
    } finally {
      setLoading(false);
    }
  };

  const metrics = evalRun ? [
    { label: "faithfulness",      val: evalRun.faithfulness,       color: "bg-emerald-400" },
    { label: "relevance",         val: evalRun.relevance,          color: "bg-emerald-400" },
    { label: "tool accuracy",     val: evalRun.tool_accuracy,      color: "bg-violet-400" },
    { label: "hallucination rate",val: evalRun.hallucination_rate, color: "bg-amber-400", invert: true },
  ] : [];

  const overall = evalRun?.overall_score;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[11px] font-mono text-white/40 tracking-widest">AUTO-EVAL — LLM-AS-A-JUDGE</p>
        <button onClick={runEval} disabled={loading} className="flex items-center gap-1.5 text-[11px] font-mono text-violet-300 border border-violet-500/30 px-2.5 py-1 rounded-md hover:bg-violet-500/10 transition-all disabled:opacity-50">
          {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          Run Eval
        </button>
      </div>

      {/* Score ring */}
      <div className="flex items-center justify-center py-4">
        <div className="relative w-28 h-28">
          <svg className="-rotate-90" width="112" height="112" viewBox="0 0 112 112">
            <circle cx="56" cy="56" r="46" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
            <circle cx="56" cy="56" r="46" fill="none" stroke="#22d3a0" strokeWidth="10"
              strokeDasharray="289" strokeDashoffset={overall ? 289 - (overall * 289) : 289}
              strokeLinecap="round" style={{ transition: "stroke-dashoffset 1.5s ease" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold">{overall ? `${Math.round(overall * 100)}%` : "—"}</span>
            <span className="text-[10px] font-mono text-white/30">accuracy</span>
          </div>
        </div>
      </div>

      {/* Metric bars */}
      <div className="space-y-3">
        {metrics.map((m) => (
          <div key={m.label} className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-white/40 w-36 flex-shrink-0">{m.label}</span>
            <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
              <div className={`h-full ${m.color} rounded-full transition-all duration-1000`}
                style={{ width: `${((m.invert ? 1 - (m.val ?? 0) : (m.val ?? 0)) * 100).toFixed(1)}%` }} />
            </div>
            <span className="text-[11px] font-mono text-white/40 w-10 text-right">
              {m.val !== undefined ? `${(m.val * 100).toFixed(1)}%` : "—"}
            </span>
          </div>
        ))}
        {!evalRun && <p className="text-center text-[11px] font-mono text-white/20 pt-4">Run eval to generate scores</p>}
      </div>

      {evalRun && (
        <div className="mt-4 pt-4 border-t border-white/[0.07] flex justify-between text-[11px] font-mono text-white/40">
          <span>{evalRun.test_cases_passed}/{evalRun.test_cases_total} cases passed</span>
          <span>p50: {evalRun.latency_p50_ms?.toFixed(0)}ms</span>
        </div>
      )}
    </div>
  );
}


// ── Graph View ───────────────────────────────────────────────────────────────
export function GraphView({ agent }: { agent: Agent | null }) {
  if (!agent) {
    return <p className="text-center text-[11px] font-mono text-white/20 mt-20">Compile an agent to see its reasoning graph</p>;
  }

  return (
    <div>
      <p className="text-[11px] font-mono text-white/40 tracking-widest mb-4">
        REASONING GRAPH — {agent.framework.toUpperCase()}
      </p>
      <svg width="100%" viewBox="0 0 460 260" className="text-white">
        <defs>
          <marker id="arr2" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="rgba(124,106,255,0.5)" />
          </marker>
        </defs>
        {[
          { x: 10,  y: 110, w: 80,  label: "START",   color: "rgba(124,106,255,0.15)", stroke: "rgba(124,106,255,0.4)", text: "rgba(165,148,255,1)" },
          { x: 120, y: 50,  w: 90,  label: "intake",   color: "rgba(34,211,160,0.1)",  stroke: "rgba(34,211,160,0.3)",  text: "rgba(34,211,160,1)" },
          { x: 120, y: 170, w: 90,  label: "tools",    color: "rgba(240,168,48,0.1)",  stroke: "rgba(240,168,48,0.3)",  text: "rgba(240,168,48,1)" },
          { x: 250, y: 110, w: 90,  label: "reason",   color: "rgba(34,211,160,0.1)",  stroke: "rgba(34,211,160,0.3)",  text: "rgba(34,211,160,1)" },
          { x: 380, y: 110, w: 70,  label: "output",   color: "rgba(232,112,200,0.1)", stroke: "rgba(232,112,200,0.3)", text: "rgba(232,112,200,1)" },
        ].map((n) => (
          <g key={n.label}>
            <rect x={n.x} y={n.y} width={n.w} height={36} rx={8} fill={n.color} stroke={n.stroke} strokeWidth={1} />
            <text x={n.x + n.w / 2} y={n.y + 22} textAnchor="middle" fontFamily="JetBrains Mono" fontSize={11} fill={n.text}>{n.label}</text>
          </g>
        ))}
        {[
          [90, 128, 120, 68], [90, 128, 120, 188], [210, 68, 250, 128],
          [210, 188, 250, 148], [340, 128, 380, 128],
        ].map(([x1,y1,x2,y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(124,106,255,0.3)" strokeWidth={1} markerEnd="url(#arr2)" />
        ))}
      </svg>
      <div className="mt-4 text-[11px] font-mono text-white/30 text-center">
        {agent.framework} graph · model: {agent.base_model} · tools: {agent.tools.length}
      </div>
    </div>
  );
}


// ── Code Export ──────────────────────────────────────────────────────────────
export function CodeExport({ agent, tools, guardrails }: {
  agent: Agent | null;
  tools: string[];
  guardrails: string[];
}) {
  const [copied, setCopied] = useState(false);

  if (!agent) {
    return <p className="text-center text-[11px] font-mono text-white/20 mt-20">Compile an agent to export code</p>;
  }

  const code = `# AgenticFlow Export — ${agent.name}
# Framework: LangGraph | Model: ${agent.base_model}
# Run locally with Ollama (free) or Groq API (free tier)
# pip install langgraph langchain-groq langchain-community

from typing import TypedDict
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_groq import ChatGroq          # or ChatOllama for local
from langgraph.graph import StateGraph, END

# ── Config ────────────────────────────────────────────────
MODEL = "${agent.base_model}"
GOAL = """${agent.goal.slice(0, 120)}"""
TOOLS = ${JSON.stringify(tools)}
GUARDRAILS = ${JSON.stringify(guardrails)}

# ── LLM (free via Groq — get key at groq.com) ────────────
llm = ChatGroq(api_key="YOUR_GROQ_KEY", model="llama-3.1-8b-instant")
# For 100% local (no key needed):
# from langchain_community.chat_models import ChatOllama
# llm = ChatOllama(model="llama3.1:8b")

# ── State ─────────────────────────────────────────────────
class AgentState(TypedDict):
    messages: list
    final_output: str

# ── Nodes ─────────────────────────────────────────────────
system_prompt = f"You are an AI agent. Goal: {GOAL}"

def reason_node(state: AgentState) -> AgentState:
    sys = SystemMessage(content=system_prompt)
    response = llm.invoke([sys] + state["messages"])
    return {**state, "messages": state["messages"] + [response],
            "final_output": response.content}

# ── Graph ─────────────────────────────────────────────────
graph = StateGraph(AgentState)
graph.add_node("reason", reason_node)
graph.set_entry_point("reason")
graph.add_edge("reason", END)
app = graph.compile()

# ── Run ───────────────────────────────────────────────────
if __name__ == "__main__":
    result = app.invoke({
        "messages": [HumanMessage(content="Hello, what can you do?")],
        "final_output": "",
    })
    print(result["final_output"])
`;

  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Code copied!");
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-mono text-white/40 tracking-widest">EXPORT — FRAMEWORK-AGNOSTIC</p>
        <button onClick={copy} className="flex items-center gap-1.5 text-[11px] font-mono text-white/40 border border-white/[0.07] px-2.5 py-1 rounded-md hover:text-white transition-all">
          {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="flex-1 bg-[#0a0a0f] border border-white/[0.07] rounded-xl p-4 text-[11px] font-mono text-white/50 overflow-auto leading-6 whitespace-pre-wrap">
        {code}
      </pre>
    </div>
  );
}
