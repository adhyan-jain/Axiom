import { prisma } from "@/lib/prisma";

export const revalidate = 0;

export default async function ActionsPage() {
  const [tasks, approvals] = await Promise.all([
    prisma.task.findMany({
      orderBy: { createdAt: "desc" },
    }),
    prisma.approvalRequest.findMany({
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10 space-y-8">
      <div className="flex items-center justify-between border-b pb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            Proactive Actions & Approvals
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Operator agent task queue and pending approval requests gated by permission policy
          </p>
        </div>
      </div>

      {/* Pending Approvals */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          Pending Approval Requests ({approvals.filter((a) => a.status === "PENDING").length})
        </h2>
        {approvals.length === 0 ? (
          <div className="p-6 text-center border rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-500 text-sm">
            No pending approval requests requiring founder intervention.
          </div>
        ) : (
          approvals.map((approval) => (
            <div
              key={approval.id}
              className="p-5 border border-amber-500/30 rounded-xl bg-amber-500/5 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {approval.reason || "Action Requires Approval"}
                </span>
                <span className="text-xs px-2.5 py-1 rounded-full font-mono bg-amber-500/20 text-amber-600 font-medium">
                  {approval.status}
                </span>
              </div>
              <div className="text-xs font-mono bg-slate-900 text-slate-200 p-3 rounded-lg overflow-x-auto">
                <span className="text-slate-400 block mb-1">Serialized Tool Invocation (replays without re-running agent reasoning):</span>
                {JSON.stringify(approval.toolInvocation, null, 2)}
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700">
                  Approve
                </button>
                <button className="px-4 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700">
                  Reject
                </button>
                <button className="px-4 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold">
                  Investigate
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Task Queue */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          Operator Task Queue ({tasks.length})
        </h2>
        {tasks.length === 0 ? (
          <div className="p-6 text-center border rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-500 text-sm">
            No active tasks in the queue.
          </div>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className="p-5 border rounded-xl bg-card text-card-foreground shadow-sm space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {task.title}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded border font-mono bg-slate-100 dark:bg-slate-800 text-slate-600">
                    {task.priority}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded border font-mono bg-indigo-500/10 text-indigo-600">
                    {task.status}
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-500">Why: {task.why}</p>
              {task.impact && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400">Impact: {task.impact}</p>
              )}
            </div>
          ))
        )}
      </div>
    </main>
  );
}
