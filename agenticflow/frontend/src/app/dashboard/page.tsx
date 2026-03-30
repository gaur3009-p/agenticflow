"use client";
import { useEffect } from "react";
import Link from "next/link";
import { Plus, RefreshCw, Zap, Phone, BarChart2, CreditCard } from "lucide-react";
import { useAgentStore, useWorkspaceStore } from "@/store";
import type { Agent } from "@/types";

const STATUS_COLORS: Record<string, string> = {
  live:     "text-emerald-400",
  training: "text-amber-400",
  draft:    "text-white/30",
  error:    "text-red-400",
  compiling:"text-violet-400",
  archived: "text-white/20",
};

function ScoreBadge({ score }: { score?: number }) {
  if (score === undefined || score === null) return <span className="text-white/20 font-mono text-xs">—</span>;
  const pct = Math.round(score * 100);
  const cls = pct >= 85 ? "bg-emerald-400/10 text-emerald-400" : pct >= 70 ? "bg-amber-400/10 text-amber-400" : "bg-red-400/10 text-red-400";
  return <span className={`text-xs font-mono px-2 py-0.5 rounded-md ${cls}`}>{pct}%</span>;
}

function AgentRow({ agent }: { agent: Agent }) {
  return (
    <div className="grid grid-cols-[2fr_1fr_1fr_1fr_80px] items-center px-4 py-3.5 border-b border-white/[0.05] hover:bg-white/[0.02] transition-colors">
      <div>
        <div className="font-semibold text-sm">{agent.name}</div>
        <div className="text-[11px] font-mono text-white/30 mt-0.5">{agent.framework} · {agent.tools.slice(0,2).join(", ")}{agent.tools.length > 2 ? ` +${agent.tools.length-2}` : ""}</div>
      </div>
      <div className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${agent.status === "live" ? "bg-emerald-400" : "bg-amber-400"}`} />
        <span className={`text-xs font-mono capitalize ${STATUS_COLORS[agent.status] ?? "text-white/40"}`}>{agent.status}</span>
      </div>
      <div className="text-[11px] font-mono text-white/30">{agent.base_model}</div>
      <div><ScoreBadge score={agent.accuracy_score} /></div>
      <div>
        <Link href="/builder" className="text-[11px] font-mono text-white/30 border border-white/[0.07] px-2.5 py-1 rounded-md hover:text-accent-light hover:border-accent/30 transition-all">
          Edit
        </Link>
      </div>
    </div>
  );
}

// Mock agents for demo when API is not connected
const MOCK_AGENTS: Agent[] = [
  { id:"1", workspace_id:"ws1", name:"SalesQualifier-Pro", slug:"salesqualifier-pro", goal:"Qualify leads", base_model:"llama3.1:70b", framework:"langgraph", tools:["HubSpot","Gmail"], guardrails:["No PII output"], status:"live", call_count:1847, accuracy_score:0.942, created_at:new Date().toISOString(), updated_at:new Date().toISOString() },
  { id:"2", workspace_id:"ws1", name:"SupportTriage-v2",   slug:"supporttriage-v2",   goal:"Triage support", base_model:"deepseek-r1", framework:"crewai", tools:["Notion","Jira","Slack"], guardrails:[], status:"live", call_count:3201, accuracy_score:0.971, created_at:new Date().toISOString(), updated_at:new Date().toISOString() },
  { id:"3", workspace_id:"ws1", name:"ContentWriter-SEO",  slug:"contentwriter-seo",  goal:"Write SEO content", base_model:"qwen3:32b", framework:"langgraph", tools:["Web Search"], guardrails:[], status:"live", call_count:562, accuracy_score:0.889, created_at:new Date().toISOString(), updated_at:new Date().toISOString() },
  { id:"4", workspace_id:"ws1", name:"DataAnalyst-Fin",    slug:"dataanalyst-fin",    goal:"Analyse finance data", base_model:"phi4", framework:"autogen", tools:["SQL DB","Code Exec"], guardrails:[], status:"training", call_count:0, accuracy_score:0.763, created_at:new Date().toISOString(), updated_at:new Date().toISOString() },
  { id:"5", workspace_id:"ws1", name:"OnboardingBot-HR",   slug:"onboardingbot-hr",   goal:"Onboard employees", base_model:"gemma2:9b", framework:"agno", tools:["Gmail","Notion","Slack"], guardrails:[], status:"live", call_count:280, accuracy_score:0.918, created_at:new Date().toISOString(), updated_at:new Date().toISOString() },
];

export default function DashboardPage() {
  const { agents, fetchAgents } = useAgentStore();
  const { activeWorkspace } = useWorkspaceStore();

  useEffect(() => {
    if (activeWorkspace) fetchAgents(activeWorkspace.id).catch(() => {});
  }, [activeWorkspace, fetchAgents]);

  const displayAgents = agents.length > 0 ? agents : MOCK_AGENTS;
  const liveCount = displayAgents.filter((a) => a.status === "live").length;
  const avgScore = displayAgents.filter((a) => a.accuracy_score).reduce((s, a) => s + (a.accuracy_score ?? 0), 0) / (displayAgents.filter((a) => a.accuracy_score).length || 1);
  const totalCalls = displayAgents.reduce((s, a) => s + a.call_count, 0);

  return (
    <div className="p-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Agent Dashboard</h1>
          <p className="text-white/30 font-mono text-xs mt-1">workspace: acme-corp · {displayAgents.length} agents · updated just now</p>
        </div>
        <Link href="/builder" className="flex items-center gap-2 bg-accent hover:bg-accent-light text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-all">
          <Plus size={15} /> New Agent
        </Link>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: "DEPLOYED AGENTS", val: displayAgents.length, change: "↑ 2 this week", icon: <Zap size={14} /> },
          { label: "AVG ACCURACY",    val: `${(avgScore*100).toFixed(1)}%`, change: "↑ 3.2% from last run", icon: <BarChart2 size={14} />, valCls: "text-emerald-400" },
          { label: "CALLS TODAY",     val: totalCalls.toLocaleString(), change: "↑ 12% vs yesterday", icon: <Phone size={14} /> },
          { label: "CREDITS LEFT",    val: "340", change: "Pro plan · renews Apr 1", icon: <CreditCard size={14} />, valCls: "text-amber-400" },
        ].map((c) => (
          <div key={c.label} className="bg-bg-secondary border border-white/[0.07] rounded-xl p-4">
            <div className="flex items-center gap-1.5 text-white/30 mb-2">
              {c.icon}
              <span className="text-[10px] font-mono tracking-wider">{c.label}</span>
            </div>
            <div className={`text-2xl font-black tracking-tight ${c.valCls ?? ""}`}>{c.val}</div>
            <div className="text-[10px] font-mono text-emerald-400 mt-1">{c.change}</div>
          </div>
        ))}
      </div>

      {/* Agent table */}
      <div className="bg-bg-secondary border border-white/[0.07] rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_80px] px-4 py-3 border-b border-white/[0.07]">
          {["AGENT", "STATUS", "MODEL", "ACCURACY", ""].map((h) => (
            <span key={h} className="text-[10px] font-mono text-white/30 tracking-wider">{h}</span>
          ))}
        </div>
        {displayAgents.map((a) => <AgentRow key={a.id} agent={a} />)}
      </div>
    </div>
  );
}
