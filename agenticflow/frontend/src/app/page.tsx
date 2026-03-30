"use client";
import Link from "next/link";
import { Zap, Brain, BarChart2, Terminal, ArrowRight, Shield, Unlock, Target } from "lucide-react";

const STEPS = [
  { icon: <Terminal size={20} />, title: "Intake — Form to Logic", desc: "Fill a structured form. The Compiler translates it into a LangGraph reasoning graph.", tag: "LangGraph / CrewAI", color: "text-violet-300", bg: "bg-violet-500/10" },
  { icon: <Zap size={20} />,      title: "Sandbox — Instant UI",   desc: "Agent spins up in a containerized Gradio interface with its own API endpoint. Live immediately.", tag: "Gradio / Docker", color: "text-emerald-300", bg: "bg-emerald-500/10" },
  { icon: <Brain size={20} />,    title: "Brain — Auto Training",   desc: "Upload Golden Datasets. LoRA fine-tuning runs in the background, specializing your model.", tag: "LoRA / QLoRA / PEFT", color: "text-amber-300", bg: "bg-amber-500/10" },
  { icon: <BarChart2 size={20} />,title: "Proof — Auto Eval",       desc: "Built-in dashboard gives an Accuracy Score via LLM-as-a-Judge. Proves production readiness.", tag: "DeepEval / RAGAS", color: "text-pink-300", bg: "bg-pink-500/10" },
];

const EDGE = [
  { icon: <Target size={18} />,  title: "vs. n8n & Zapier",    desc: "They're Lego bricks of data. We're a Foundry for thinking. Native training + accuracy scoring—they don't have it." },
  { icon: <Unlock size={18} />,  title: "vs. Big Tech",         desc: "Google and OpenAI lock you in. We are framework-agnostic. Export your agent to run anywhere, anytime." },
  { icon: <Shield size={18} />,  title: "The Reliability Moat", desc: "Everyone can make a demo. Only AgenticFlow proves accuracy with a Hard Score—the only tool enterprises trust." },
];

const STATS = [
  { num: "12,400+", label: "agents deployed" },
  { num: "94.2%",   label: "avg accuracy score" },
  { num: "< 4 min", label: "avg build time" },
  { num: "38",      label: "supported models" },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 h-14 border-b border-white/[0.07] bg-bg-primary/90 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-accent rounded-lg flex items-center justify-center text-sm font-black text-white">AF</div>
          <span className="font-bold text-[17px] tracking-tight">AgenticFlow</span>
        </div>
        <div className="hidden md:flex items-center gap-1">
          {["Builder", "Models", "Dashboard", "Pricing"].map((item) => (
            <Link key={item} href={`/${item.toLowerCase()}`} className="px-3 py-1.5 text-sm text-white/50 hover:text-white rounded-lg hover:bg-white/5 transition-all font-mono">
              {item}
            </Link>
          ))}
        </div>
        <Link href="/builder" className="bg-accent hover:bg-accent-light text-white text-sm font-bold px-4 py-2 rounded-lg transition-all">
          Build Agent →
        </Link>
      </nav>

      {/* Hero */}
      <section className="relative text-center px-6 pt-20 pb-16 overflow-hidden">
        <div className="hero-glow absolute inset-0" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 bg-accent/10 border border-accent/30 text-accent-light text-xs font-mono px-3 py-1.5 rounded-full mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-light animate-pulse" />
            v2.4.1 — The Vercel for AI Agents
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-[1.02] mb-5">
            Turn a Job Description<br />
            into a <span className="text-accent-light">Working Agent</span><br />
            in 5 Minutes
          </h1>
          <p className="text-white/40 text-base md:text-lg font-mono max-w-xl mx-auto mb-10 leading-relaxed">
            Form → Reasoning Graph → Sandbox → Trained → Scored.<br />No code required. Free to start.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link href="/builder" className="bg-accent hover:bg-accent-light text-white font-bold text-sm px-6 py-3 rounded-xl transition-all hover:-translate-y-0.5 flex items-center gap-2">
              Start Building Free <ArrowRight size={16} />
            </Link>
            <Link href="/dashboard" className="bg-white/5 hover:bg-white/8 border border-white/[0.07] text-white text-sm font-semibold px-6 py-3 rounded-xl transition-all">
              View Live Dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="px-6 pb-16">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 divide-x divide-white/[0.07] border border-white/[0.07] rounded-2xl overflow-hidden bg-bg-secondary">
          {STATS.map((s) => (
            <div key={s.label} className="p-5 text-center">
              <div className="text-3xl font-black text-accent-light">{s.num}</div>
              <div className="text-[11px] font-mono text-white/40 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 4-Step Loop */}
      <section className="px-6 pb-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-black tracking-tight">The 4-Step Foundry Loop</h2>
            <p className="text-white/30 font-mono text-sm mt-2">// intake → sandbox → brain → proof</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {STEPS.map((s, i) => (
              <div key={s.title} className="relative bg-bg-secondary border border-white/[0.07] rounded-2xl p-6 hover:border-accent/40 transition-all group">
                <span className="absolute top-4 right-5 text-5xl font-black text-white/[0.03] font-mono">0{i+1}</span>
                <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center mb-4 ${s.color}`}>{s.icon}</div>
                <h3 className="font-bold text-sm mb-2">{s.title}</h3>
                <p className="text-white/40 text-xs font-mono leading-relaxed mb-4">{s.desc}</p>
                <span className={`text-[10px] font-mono px-2 py-1 rounded-md ${s.bg} ${s.color}`}>{s.tag}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Competitive Edge */}
      <section className="px-6 pb-20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-black tracking-tight">Why AgenticFlow Wins</h2>
            <p className="text-white/30 font-mono text-sm mt-2">// intelligence-first, not workflow-first</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {EDGE.map((e) => (
              <div key={e.title} className="bg-bg-secondary border border-white/[0.07] rounded-2xl p-6 hover:border-accent/30 transition-all">
                <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center text-accent-light mb-4">{e.icon}</div>
                <h3 className="font-bold text-sm mb-2">{e.title}</h3>
                <p className="text-white/40 text-xs font-mono leading-relaxed">{e.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 pb-24 text-center">
        <div className="max-w-2xl mx-auto bg-bg-secondary border border-white/[0.07] rounded-3xl p-12">
          <h2 className="text-4xl font-black tracking-tight mb-4">Ready to build your first agent?</h2>
          <p className="text-white/40 font-mono text-sm mb-8">Free forever. No credit card. 10 builds included.</p>
          <Link href="/builder" className="inline-flex items-center gap-2 bg-accent hover:bg-accent-light text-white font-bold px-8 py-4 rounded-xl transition-all text-base hover:-translate-y-0.5">
            Launch the Builder <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.07] px-6 py-8 flex items-center justify-between text-white/30 text-xs font-mono">
        <span>AgenticFlow v2.4.0 — MIT License</span>
        <div className="flex gap-4">
          <a href="https://github.com/your-org/agenticflow" className="hover:text-white transition-colors">GitHub</a>
          <a href="/docs" className="hover:text-white transition-colors">Docs</a>
          <a href="/pricing" className="hover:text-white transition-colors">Pricing</a>
        </div>
      </footer>
    </div>
  );
}
