import type { Detail, TaskSnapshot } from "@flow/contracts";

export type WorkspaceTabId = "files" | "terminal" | `detail:${string}`;

export interface WorkspaceDetailState {
  data?: Detail;
  loading?: boolean;
  error?: string;
}

export interface WorkspacePanelsProps {
  task: TaskSnapshot | null;
  details: Record<string, WorkspaceDetailState>;
  onLoadDetail: (id: string) => void | Promise<void>;
  connection?: "connecting" | "live" | "reconnecting" | "disconnected";
  activeTab?: WorkspaceTabId;
  onActiveTabChange?: (tab: WorkspaceTabId) => void;
  onClose?: () => void;
  className?: string;
}
