import { prisma } from "@/lib/prisma";

export const revalidate = 0;

export default async function IntegrationsPage() {
  const integrations = await prisma.integration.findMany({
    orderBy: { provider: "asc" },
  });

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10 space-y-6">
      <div className="flex items-center justify-between border-b pb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            Integrations & Connectors
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Seeded data sources and live integration connectors (Gmail, Slack, Calendar, Drive, GitHub)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {integrations.map((item) => (
          <div key={item.id} className="p-6 border rounded-xl bg-card text-card-foreground shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-bold text-lg text-slate-900 dark:text-slate-100 font-mono">
                {item.provider}
              </span>
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-mono font-semibold ${
                  item.mode === "SEEDED"
                    ? "bg-indigo-500/10 text-indigo-600 border border-indigo-500/20"
                    : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                }`}
              >
                {item.mode} MODE
              </span>
            </div>

            <div className="text-xs text-slate-500 space-y-1">
              <div className="flex justify-between">
                <span>Status:</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">{item.status}</span>
              </div>
              <div className="flex justify-between">
                <span>Last Synced:</span>
                <span>{item.lastSyncAt ? new Date(item.lastSyncAt).toLocaleString() : "N/A"}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
