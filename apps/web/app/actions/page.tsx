import { prisma } from "@/lib/prisma";
import { Surface } from "@/components/primitives";
import ApprovalCard from "@/components/ApprovalCard";
import TaskCard from "@/components/TaskCard";

export const revalidate = 0;

export default async function ActionsPage() {
  const [tasks, approvals] = await Promise.all([
    prisma.task.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.approvalRequest.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  const pending = approvals.filter((a) => a.status === "PENDING");
  const resolved = approvals.filter((a) => a.status !== "PENDING");

  return (
    <main className="mx-auto min-h-screen max-w-5xl space-y-8 px-6 py-10">
      <div className="border-b border-hairline pb-6">
        <h1 className="display-heading text-display-lg text-ink-primary">Actions</h1>
        <p className="mt-1 text-body-sm text-ink-secondary">
          Where each proposal sits on the observed → recommended → executed → verified
          authority spectrum, and what still needs your authority
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="display-heading text-display-sm text-ink-primary">
          Awaiting your authority ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <Surface tier={1} className="p-6 text-center text-body-sm text-ink-faint">
            Nothing is waiting on you right now.
          </Surface>
        ) : (
          <div className="space-y-4">
            {pending.map((approval) => (
              <ApprovalCard key={approval.id} approval={approval} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="display-heading text-display-sm text-ink-primary">
          Task queue ({tasks.length})
        </h2>
        {tasks.length === 0 ? (
          <Surface tier={1} className="p-6 text-center text-body-sm text-ink-faint">
            No active tasks in the queue.
          </Surface>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        )}
      </section>

      {resolved.length > 0 && (
        <section className="space-y-4">
          <h2 className="display-heading text-display-sm text-ink-primary">
            Resolved approvals ({resolved.length})
          </h2>
          <div className="space-y-3">
            {resolved.map((approval) => (
              <ApprovalCard key={approval.id} approval={approval} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
