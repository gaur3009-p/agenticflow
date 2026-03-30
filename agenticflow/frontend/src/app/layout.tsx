import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgenticFlow — The Vercel for AI Agents",
  description: "Build, train, and deploy AI agents in under 5 minutes. Form → Reasoning Graph → Sandbox → Eval.",
  keywords: ["AI agents", "LangGraph", "LLM", "fine-tuning", "LoRA"],
  openGraph: {
    title: "AgenticFlow",
    description: "The Vercel for AI Agents",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      </head>
      <body className="bg-bg-primary text-white antialiased min-h-screen">
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#1a1a24",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#f0f0fa",
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "13px",
            },
          }}
        />
      </body>
    </html>
  );
}
