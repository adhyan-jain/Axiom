import { Surface, AuthorityBadge, AgentState } from "@/components/primitives";
import type { AuthorityState } from "@/components/primitives";

type TaskLike = {
  id: string;
  title: string;
  why: string;
  impact: string | null;
  source: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status: "OPEN" | "IN_PROGRESS" | "DONE" | "DISMISSED";
};

const STATUS_TO_AUTHORITY: Record<TaskLike["status"], AuthorityState> = {
  OPEN: "recommended",
  IN_PROGRESS: "drafted",
  DONE: "verified",
  DISMISSED: "rejected",
};

const PRIORITY_TONE: Record<TaskLike["priority"], string> = {
  LOW: "text-ink-faint",
  MEDIUM: "text-signal-uncertainty",
  HIGH: "text-signal-warning",
  URGENT: "text-signal-risk",
};

/** TaskCard — one Operator-proposed task, authority state instead of badge soup. */
export default function TaskCard({ task }: { task: TaskLike }) {
  const agentSource = task.source.startsWith("event:") ? "observer" : task.source.replace(/_/g, " ");
  return (
    <Surface tier={2} className="space-y-2 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-body font-medium text-ink-primary">{task.title}</h3>
          <p className="text-body-sm text-ink-secondary">{task.why}</p>
          {task.impact && <p className="mt-0.5 text-body-sm text-trajectory-positive">Impact: {task.impact}</p>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <AuthorityBadge state={STATUS_TO_AUTHORITY[task.status]} />
          <span className={`text-body-sm font-num ${PRIORITY_TONE[task.priority]}`}>{task.priority}</span>
        </div>
      </div>
      <AgentState agent={agentSource} activity={task.status === "IN_PROGRESS" ? "executing" : "idle"} />
    </Surface>
  );
}
