/**
 * AgenticFlow — API Client
 * Axios instance with JWT auth, retry logic, and typed helpers
 */
import axios, { AxiosError, AxiosResponse } from "axios";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30_000,
  headers: { "Content-Type": "application/json" },
});

// ── Request interceptor: attach JWT ────────────────────────────────────────
apiClient.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("af_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor: handle 401 ──────────────────────────────────────
apiClient.interceptors.response.use(
  (res: AxiosResponse) => res,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("af_token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// ── Typed API functions ────────────────────────────────────────────────────

import type {
  Agent, AgentCreate, AgentRunRequest, AgentRunResponse,
  EvalRun, TrainingJob, TrainingJobCreate, User, Workspace,
} from "@/types";

// Auth
export const authApi = {
  register: (data: { email: string; name: string; password: string }) =>
    apiClient.post("/auth/register", data).then((r) => r.data),
  login: (email: string, password: string) =>
    apiClient.post("/auth/login", new URLSearchParams({ username: email, password }), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }).then((r) => r.data),
  me: (): Promise<User> => apiClient.get("/auth/me").then((r) => r.data),
};

// Workspaces
export const workspaceApi = {
  list: (ownerId: string): Promise<Workspace[]> =>
    apiClient.get("/workspace", { params: { owner_id: ownerId } }).then((r) => r.data),
  create: (name: string, ownerId: string): Promise<Workspace> =>
    apiClient.post("/workspace", { name }, { params: { owner_id: ownerId } }).then((r) => r.data),
};

// Agents
export const agentApi = {
  list: (workspaceId: string): Promise<Agent[]> =>
    apiClient.get("/agents", { params: { workspace_id: workspaceId } }).then((r) => r.data),
  get: (agentId: string): Promise<Agent> =>
    apiClient.get(`/agents/${agentId}`).then((r) => r.data),
  create: (workspaceId: string, data: AgentCreate): Promise<Agent> =>
    apiClient.post("/agents", data, { params: { workspace_id: workspaceId } }).then((r) => r.data),
  update: (agentId: string, data: Partial<AgentCreate>): Promise<Agent> =>
    apiClient.put(`/agents/${agentId}`, data).then((r) => r.data),
  delete: (agentId: string): Promise<void> =>
    apiClient.delete(`/agents/${agentId}`).then((r) => r.data),
  compile: (agentId: string): Promise<Agent> =>
    apiClient.post(`/agents/${agentId}/compile`).then((r) => r.data),
  run: (agentId: string, payload: AgentRunRequest): Promise<AgentRunResponse> =>
    apiClient.post(`/agents/${agentId}/run`, payload).then((r) => r.data),
};

// Training
export const trainingApi = {
  startJob: (agentId: string, config: TrainingJobCreate, file: File): Promise<TrainingJob> => {
    const form = new FormData();
    form.append("dataset", file);
    Object.entries(config).forEach(([k, v]) => form.append(k, String(v)));
    return apiClient.post(`/training/${agentId}/jobs`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then((r) => r.data);
  },
  listJobs: (agentId: string): Promise<TrainingJob[]> =>
    apiClient.get(`/training/${agentId}/jobs`).then((r) => r.data),
};

// Eval
export const evalApi = {
  triggerRun: (agentId: string): Promise<EvalRun> =>
    apiClient.post(`/eval/${agentId}/runs`).then((r) => r.data),
  listRuns: (agentId: string): Promise<EvalRun[]> =>
    apiClient.get(`/eval/${agentId}/runs`).then((r) => r.data),
  getLatest: (agentId: string): Promise<EvalRun> =>
    apiClient.get(`/eval/${agentId}/runs/latest`).then((r) => r.data),
};

// WebSocket streaming helper
export function createStreamingSocket(agentId: string, onToken: (t: string) => void, onDone: () => void) {
  const wsUrl = BASE_URL.replace("http", "ws").replace("/api/v1", "");
  const ws = new WebSocket(`${wsUrl}/api/v1/agents/${agentId}/stream`);
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === "token") onToken(msg.content);
    if (msg.type === "done") onDone();
  };
  return ws;
}
