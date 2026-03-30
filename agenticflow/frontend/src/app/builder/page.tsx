"use client";
import { AgentBuilder } from "@/components/builder/AgentBuilder";
import { useWorkspaceStore } from "@/store";

export default function BuilderPage() {
  const { activeWorkspace } = useWorkspaceStore();
  // Default workspace ID for demo/dev; replace with real auth flow
  const workspaceId = activeWorkspace?.id ?? "00000000-0000-0000-0000-000000000001";
  return <AgentBuilder workspaceId={workspaceId} />;
}
