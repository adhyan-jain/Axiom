"use client";

import DecisionForm from "@/components/DecisionForm";

/** Thin client wrapper so the (server) Decisions page can embed the create form. */
export default function DecisionLogger() {
  return <DecisionForm mode="create" />;
}
