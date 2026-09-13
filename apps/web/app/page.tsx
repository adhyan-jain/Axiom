import { checkAgentServiceHealth } from "@/lib/agentServiceClient";

export default async function HomePage() {
  const health = await checkAgentServiceHealth();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-start justify-center gap-4 px-6">
      <h1 className="text-3xl font-semibold">Hello Company</h1>
      <p className="text-slate-400">
        Axiom — agentic company-OS. Slice 0 round trip: apps/web server-fetching
        apps/agent-service.
      </p>
      <div
        className={`rounded-lg border px-4 py-3 font-mono text-sm ${
          health.ok
            ? "border-emerald-700 bg-emerald-950 text-emerald-300"
            : "border-red-700 bg-red-950 text-red-300"
        }`}
      >
        {health.ok ? `agent-service: ${health.status}` : `agent-service: unreachable (${health.error})`}
      </div>
    </main>
  );
}
