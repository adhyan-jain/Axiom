"use client";

import { useState, useTransition } from "react";
import { disconnectIntegrationAction } from "@/app/integrations/actions";
import { Surface, AuthorityBadge } from "@/components/primitives";
import type { OAuthSlug } from "@/lib/oauthProviders";

type IntegrationLike = {
  id: string | null;
  provider: string;
  mode: "SEEDED" | "LIVE";
  status: "CONNECTED" | "DISCONNECTED" | "ERROR";
  lastSyncAt: string | Date | null;
  externalAccountId: string | null;
  lastError: string | null;
};

/**
 * IntegrationCard — Connect/Disconnect per provider, backed by a real OAuth route
 * (Connect is a plain link to /api/integrations/:slug/connect, which redirects to the
 * real provider auth page or fails gracefully if env creds are missing — never a fake
 * "looks connected" UI). Disconnect is a Server Action.
 */
export default function IntegrationCard({
  slug,
  displayName,
  integration,
  configured,
  missingEnvVar,
}: {
  slug: OAuthSlug;
  displayName: string;
  integration: IntegrationLike | null;
  configured: boolean;
  missingEnvVar?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [disconnected, setDisconnected] = useState(false);

  const status = disconnected ? "DISCONNECTED" : integration?.status ?? "DISCONNECTED";
  const connected = status === "CONNECTED";

  const disconnect = () => {
    if (!integration?.id) return;
    setError(null);
    startTransition(async () => {
      const result = await disconnectIntegrationAction(integration.id!);
      if (!result.ok) setError(result.error);
      else setDisconnected(true);
    });
  };

  return (
    <Surface tier={1} className="space-y-3 p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-body-lg font-medium text-ink-primary">{displayName}</h3>
        <AuthorityBadge
          state={connected ? "authorized" : status === "ERROR" ? "failed" : "observed"}
        />
      </div>

      <div className="space-y-1 text-body-sm text-ink-secondary">
        <div className="flex justify-between">
          <span>Mode</span>
          <span className="font-num text-ink-primary">{integration?.mode ?? "SEEDED"}</span>
        </div>
        <div className="flex justify-between">
          <span>Last synced</span>
          <span className="font-num text-ink-primary">
            {integration?.lastSyncAt ? new Date(integration.lastSyncAt).toLocaleString() : "Never"}
          </span>
        </div>
        {integration?.externalAccountId && (
          <div className="flex justify-between">
            <span>Account</span>
            <span className="font-num text-ink-primary">{integration.externalAccountId}</span>
          </div>
        )}
      </div>

      {!configured && (
        <p className="rounded border border-signal-warning/40 bg-signal-warning/10 px-3 py-2 text-body-sm text-signal-warning">
          Integration not configured — add {missingEnvVar} to .env to enable a real connect flow.
        </p>
      )}

      {(integration?.lastError || error) && (
        <p className="rounded border border-signal-risk/40 bg-signal-risk/10 px-3 py-2 text-body-sm text-signal-risk">
          {integration?.lastError ?? error}
        </p>
      )}

      <div className="flex items-center gap-3">
        {connected ? (
          <button
            onClick={disconnect}
            disabled={isPending}
            className="rounded border border-hairline px-3 py-1.5 text-body-sm text-signal-risk hover:bg-surface-2 disabled:opacity-50"
          >
            {isPending ? "Disconnecting…" : "Disconnect"}
          </button>
        ) : (
          <a
            href={`/api/integrations/${slug}/connect`}
            aria-disabled={!configured}
            className={`rounded border px-3 py-1.5 text-body-sm font-medium ${
              configured
                ? "border-signal-action/40 bg-signal-action/15 text-signal-action hover:bg-signal-action/25"
                : "cursor-not-allowed border-hairline text-ink-faint"
            }`}
            onClick={(e) => {
              if (!configured) e.preventDefault();
            }}
          >
            Connect
          </a>
        )}
      </div>
    </Surface>
  );
}
