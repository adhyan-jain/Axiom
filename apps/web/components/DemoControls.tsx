"use client";

import { useState } from "react";
import { runDemoStepAction } from "@/app/demo-actions";

export default function DemoControls() {
  const [loadingStep, setLoadingStep] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const runStep = async (step: 1 | 2 | 3) => {
    setLoadingStep(step);
    setMessage(null);
    try {
      const res = await runDemoStepAction(step);
      if (res.ok) {
        setMessage(`Step ${step} executed successfully! Reloading...`);
        setTimeout(() => window.location.reload(), 1200);
      } else {
        setMessage(`Error: ${res.error}`);
      }
    } catch (e: any) {
      setMessage(`Failed: ${e.message}`);
    } finally {
      setLoadingStep(null);
    }
  };

  return (
    <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Flagship Demo Controls (SDD §8)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Trigger end-to-end multi-agent pipeline steps live in sequence
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => runStep(1)}
          disabled={loadingStep !== null}
          className="p-4 rounded-lg border bg-card text-left text-xs font-semibold hover:border-indigo-500 transition-colors disabled:opacity-50 space-y-1"
        >
          <div className="text-indigo-600 dark:text-indigo-400 font-bold">Step 1 — New Contract</div>
          <div className="text-slate-500 font-normal">
            Close Nimbus Health ₹2L contract → Invoice + Onboarding tasks + Trajectory update
          </div>
        </button>

        <button
          onClick={() => runStep(2)}
          disabled={loadingStep !== null}
          className="p-4 rounded-lg border bg-card text-left text-xs font-semibold hover:border-indigo-500 transition-colors disabled:opacity-50 space-y-1"
        >
          <div className="text-amber-600 dark:text-amber-400 font-bold">Step 2 — AWS Cost Spike</div>
          <div className="text-slate-500 font-normal">
            Simulate AWS spend spike (₹45k → ₹78k) → Anomaly detected → Policy conflict flagged
          </div>
        </button>

        <button
          onClick={() => runStep(3)}
          disabled={loadingStep !== null}
          className="p-4 rounded-lg border bg-card text-left text-xs font-semibold hover:border-indigo-500 transition-colors disabled:opacity-50 space-y-1"
        >
          <div className="text-emerald-600 dark:text-emerald-400 font-bold">Step 3 — Dev Hiring Scenario</div>
          <div className="text-slate-500 font-normal">
            Run counterfactual hiring comparison → Deterministic runway math + LLM recommendation
          </div>
        </button>
      </div>

      {message && (
        <div className="text-xs font-mono text-center text-indigo-600 dark:text-indigo-400 pt-2">
          {message}
        </div>
      )}
    </div>
  );
}
