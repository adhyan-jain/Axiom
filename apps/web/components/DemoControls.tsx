"use client";

import { useState } from "react";
import { runDemoStepAction } from "@/app/demo-actions";
import { Surface } from "@/components/primitives";

const STEPS: { step: 1 | 2 | 3; title: string; detail: string; tone: string }[] = [
  {
    step: 1,
    title: "New contract signed",
    detail: "Close Nimbus Health ₹2L contract → invoice + onboarding tasks → trajectory update",
    tone: "text-signal-action",
  },
  {
    step: 2,
    title: "AWS cost spike",
    detail: "Simulate AWS spend spike (₹45k → ₹78k) → anomaly detected → decision conflict flagged",
    tone: "text-signal-warning",
  },
  {
    step: 3,
    title: "Hiring scenario",
    detail: "Run counterfactual hiring comparison → runway math + recommendation",
    tone: "text-trajectory-positive",
  },
];

export default function DemoControls() {
  const [loadingStep, setLoadingStep] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const runStep = async (step: 1 | 2 | 3) => {
    setLoadingStep(step);
    setMessage(null);
    try {
      const res = await runDemoStepAction(step);
      if (res.ok) {
        setMessage(`Step ${step} executed. Reloading…`);
        setTimeout(() => window.location.reload(), 1200);
      } else {
        setMessage(`Error: ${res.error}`);
      }
    } catch (e) {
      setMessage(`Failed: ${e instanceof Error ? e.message : "unknown error"}`);
    } finally {
      setLoadingStep(null);
    }
  };

  return (
    <Surface tier={1} className="p-5 space-y-4">
      <div>
        <h2 className="display-heading text-display-sm text-ink-primary">Flagship demo</h2>
        <p className="text-body-sm text-ink-secondary mt-0.5">
          Run the end-to-end multi-agent pipeline live, one step at a time
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {STEPS.map(({ step, title, detail, tone }) => (
          <button
            key={step}
            onClick={() => runStep(step)}
            disabled={loadingStep !== null}
            className="rounded border border-hairline bg-surface-2 p-3 text-left transition-colors hover:border-signal-action disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-action"
          >
            <div className={`text-body-sm font-semibold ${tone}`}>
              {loadingStep === step ? "Running…" : `${step}. ${title}`}
            </div>
            <div className="mt-1 text-body-sm text-ink-secondary">{detail}</div>
          </button>
        ))}
      </div>

      {message && (
        <div role="status" className="font-num text-body-sm text-signal-action">
          {message}
        </div>
      )}
    </Surface>
  );
}
