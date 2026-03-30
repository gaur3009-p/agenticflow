"use client";
import Link from "next/link";
import { Check } from "lucide-react";

const TIERS = [
  {
    name: "FREE",
    price: "$0",
    period: "/ month",
    desc: "For students, developers, and early experimenters. No credit card required.",
    features: ["10 build credits / month", "Gradio demo sandbox", "Free model tier only", "3 active agents", "Community support", "Export agent code"],
    cta: "Start Building →",
    href: "/builder",
    featured: false,
  },
  {
    name: "PRO",
    price: "$49",
    period: "/ month",
    desc: "For SaaS teams and SDRs automating daily workflows with production-grade agents.",
    features: ["500 build credits / month", "Persistent memory store", "Custom API endpoints", "25 active agents", "Auto LoRA fine-tuning", "Full eval dashboard", "Webhook integrations", "Priority support"],
    cta: "Upgrade to Pro →",
    href: "#",
    featured: true,
  },
  {
    name: "ENTERPRISE",
    price: "Custom",
    period: "",
    desc: "For corporations needing a secure, auditable Corporate Brain with full control.",
    features: ["Unlimited agents + credits", "MCP Connectors (private)", "RBAC + SSO", "Private Cloud / VPC deploy", "Air-gapped option", "SLA + dedicated CSM", "Custom model training", "Audit logs + compliance"],
    cta: "Contact Sales →",
    href: "mailto:sales@agenticflow.io",
    featured: false,
  },
];

export default function PricingPage() {
  return (
    <div className="p-5 max-w-5xl mx-auto">
      <div className="text-center mb-12 pt-8">
        <h1 className="text-4xl font-black tracking-tight mb-3">Simple, Usage-Based Pricing</h1>
        <p className="text-white/30 font-mono text-sm">// start free · scale when ready</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {TIERS.map((tier) => (
          <div key={tier.name} className={`relative bg-bg-secondary rounded-2xl p-7 flex flex-col border transition-all ${
            tier.featured ? "border-accent/60" : "border-white/[0.07]"
          }`}>
            {tier.featured && (
              <div className="absolute -top-px left-1/2 -translate-x-1/2 bg-accent text-white text-[10px] font-bold font-mono px-3 py-1 rounded-b-lg tracking-wider">
                MOST POPULAR
              </div>
            )}
            <div className="text-[11px] font-mono text-white/30 mb-2">{tier.name}</div>
            <div className="flex items-baseline gap-1 mb-3">
              <span className="text-4xl font-black tracking-tighter">{tier.price}</span>
              <span className="text-sm text-white/30">{tier.period}</span>
            </div>
            <p className="text-white/40 text-xs font-mono leading-relaxed mb-6">{tier.desc}</p>
            <ul className="space-y-2.5 flex-1 mb-8">
              {tier.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-xs">
                  <Check size={13} className="text-accent-light flex-shrink-0 mt-0.5" />
                  <span className="text-white/60">{f}</span>
                </li>
              ))}
            </ul>
            <Link href={tier.href} className={`w-full text-center py-3 rounded-xl text-sm font-bold transition-all ${
              tier.featured
                ? "bg-accent hover:bg-accent-light text-white"
                : "bg-white/5 hover:bg-white/8 border border-white/[0.07] text-white"
            }`}>
              {tier.cta}
            </Link>
          </div>
        ))}
      </div>

      <div className="mt-12 text-center text-white/20 font-mono text-xs">
        All plans include free model tier (Llama, DeepSeek, Mistral, Qwen via Groq + Ollama) · No lock-in · Export your code anytime
      </div>
    </div>
  );
}
