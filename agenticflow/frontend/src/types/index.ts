// AgenticFlow — Shared TypeScript Types

export type AgentStatus = "draft" | "compiling" | "live" | "training" | "error" | "archived";
export type TrainingStatus = "queued" | "running" | "completed" | "failed";
export type Tier = "free" | "pro" | "enterprise";
export type Framework = "langgraph" | "crewai" | "autogen" | "agno" | "custom";

export const FREE_MODELS = [
  { id: "llama3.1:8b",    label: "Llama 3.1 8B",           provider: "Groq",    tags: ["free", "fast"] },
  { id: "llama3.1:70b",   label: "Llama 3.1 70B",          provider: "Groq",    tags: ["free", "powerful"] },
  { id: "deepseek-r1",    label: "DeepSeek-R1",            provider: "Ollama",  tags: ["free", "reasoning"] },
  { id: "deepseek-r1:8b", label: "DeepSeek-R1 Distill 8B", provider: "Groq",    tags: ["free", "reasoning", "fast"] },
  { id: "qwen3:32b",      label: "Qwen3 32B",              provider: "Ollama",  tags: ["free", "multilingual"] },
  { id: "phi4",           label: "Phi-4",                  provider: "Ollama",  tags: ["free", "efficient"] },
  { id: "gemma2:9b",      label: "Gemma 2 9B",             provider: "Groq",    tags: ["free"] },
  { id: "mistral:7b",     label: "Mistral 7B",             provider: "Groq",    tags: ["free", "lean"] },
] as const;

export const PRO_MODELS = [
  { id: "claude-sonnet-4", label: "Claude Sonnet 4",  provider: "Anthropic", tags: ["pro", "vision"] },
  { id: "gpt-4o",          label: "GPT-4o",            provider: "OpenAI",    tags: ["pro", "vision"] },
  { id: "gpt-4o-mini",     label: "GPT-4o Mini",       provider: "OpenAI",    tags: ["pro", "fast"] },
] as const;

export const TOOL_OPTIONS = [
  "Web Search", "HubSpot", "Gmail", "Slack", "Notion",
  "Jira", "LinkedIn API", "SQL DB", "Code Exec", "File I/O",
] as const;

export const GUARDRAIL_OPTIONS = [
  "No PII output", "Max 3 tool calls", "Human-in-loop",
  "Hallucination check", "RBAC",
] as const;

export interface User {
  id: string;
  email: string;
  name: string;
  tier: Tier;
  credits: number;
  created_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
}

export interface Agent {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  goal: string;
  base_model: string;
  framework: Framework;
  tools: string[];
  guardrails: string[];
  system_prompt?: string;
  status: AgentStatus;
  container_id?: string;
  endpoint_url?: string;
  api_key?: string;
  call_count: number;
  accuracy_score?: number;
  created_at: string;
  updated_at: string;
}

export interface AgentCreate {
  name: string;
  goal: string;
  base_model: string;
  framework: Framework;
  tools: string[];
  guardrails: string[];
  system_prompt?: string;
}

export interface AgentRunRequest {
  message: string;
  session_id?: string;
  context?: Record<string, unknown>;
}

export interface AgentRunResponse {
  output: string;
  reasoning_trace?: string[];
  tool_calls?: Record<string, unknown>[];
  latency_ms: number;
  model_used: string;
}

export interface TrainingJob {
  id: string;
  agent_id: string;
  status: TrainingStatus;
  train_loss?: number;
  created_at: string;
  completed_at?: string;
  lora_r: number;
  lora_alpha: number;
  num_epochs: number;
}

export interface TrainingJobCreate {
  lora_r: number;
  lora_alpha: number;
  lora_dropout: number;
  learning_rate: number;
  num_epochs: number;
  batch_size: number;
}

export interface EvalRun {
  id: string;
  agent_id: string;
  overall_score?: number;
  faithfulness?: number;
  relevance?: number;
  tool_accuracy?: number;
  hallucination_rate?: number;
  latency_p50_ms?: number;
  latency_p99_ms?: number;
  test_cases_total: number;
  test_cases_passed: number;
  created_at: string;
}
