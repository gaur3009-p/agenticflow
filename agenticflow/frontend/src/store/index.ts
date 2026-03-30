/**
 * AgenticFlow — Zustand Global Store
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { User, Workspace, Agent } from "@/types";
import { authApi, workspaceApi, agentApi } from "@/lib/api";

// ── Auth Slice ──────────────────────────────────────────────────────────────
interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loadMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isLoading: false,
      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const data = await authApi.login(email, password);
          localStorage.setItem("af_token", data.access_token);
          set({ user: data.user, token: data.access_token, isLoading: false });
        } catch (e) {
          set({ isLoading: false });
          throw e;
        }
      },
      logout: () => {
        localStorage.removeItem("af_token");
        set({ user: null, token: null });
        window.location.href = "/login";
      },
      loadMe: async () => {
        try {
          const user = await authApi.me();
          set({ user });
        } catch {
          set({ user: null, token: null });
        }
      },
    }),
    { name: "af-auth", storage: createJSONStorage(() => localStorage), partialize: (s) => ({ token: s.token }) }
  )
);

// ── Workspace Slice ─────────────────────────────────────────────────────────
interface WorkspaceState {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  fetchWorkspaces: (userId: string) => Promise<void>;
  setActiveWorkspace: (ws: Workspace) => void;
}

export const useWorkspaceStore = create<WorkspaceState>()((set) => ({
  workspaces: [],
  activeWorkspace: null,
  fetchWorkspaces: async (userId) => {
    const data = await workspaceApi.list(userId);
    set({ workspaces: data, activeWorkspace: data[0] ?? null });
  },
  setActiveWorkspace: (ws) => set({ activeWorkspace: ws }),
}));

// ── Agent Slice ─────────────────────────────────────────────────────────────
interface AgentState {
  agents: Agent[];
  selectedAgent: Agent | null;
  isCompiling: boolean;
  fetchAgents: (workspaceId: string) => Promise<void>;
  setSelectedAgent: (a: Agent | null) => void;
  compileAgent: (agentId: string) => Promise<Agent>;
  deleteAgent: (agentId: string) => Promise<void>;
}

export const useAgentStore = create<AgentState>()((set, get) => ({
  agents: [],
  selectedAgent: null,
  isCompiling: false,
  fetchAgents: async (workspaceId) => {
    const data = await agentApi.list(workspaceId);
    set({ agents: data });
  },
  setSelectedAgent: (a) => set({ selectedAgent: a }),
  compileAgent: async (agentId) => {
    set({ isCompiling: true });
    try {
      const compiled = await agentApi.compile(agentId);
      set((state) => ({
        agents: state.agents.map((a) => (a.id === agentId ? compiled : a)),
        selectedAgent: compiled,
        isCompiling: false,
      }));
      return compiled;
    } catch (e) {
      set({ isCompiling: false });
      throw e;
    }
  },
  deleteAgent: async (agentId) => {
    await agentApi.delete(agentId);
    set((state) => ({ agents: state.agents.filter((a) => a.id !== agentId) }));
  },
}));

// ── UI Slice ────────────────────────────────────────────────────────────────
interface UIState {
  sidebarOpen: boolean;
  activeTab: string;
  toggleSidebar: () => void;
  setActiveTab: (tab: string) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  sidebarOpen: true,
  activeTab: "sandbox",
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
