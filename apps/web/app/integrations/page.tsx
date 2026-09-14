import { prisma } from "@/lib/prisma";
import { Surface, AuthorityBadge } from "@/components/primitives";
import IntegrationCard from "@/components/IntegrationCard";
import { OAUTH_PROVIDERS, type OAuthSlug } from "@/lib/oauthProviders";
import { IntegrationProvider } from "@prisma/client";

export const revalidate = 0;

const ERROR_MESSAGES: Record<string, string> = {
  unknown_provider: "Unknown integration provider.",
  not_configured: "Integration not configured — missing credentials.",
  state_mismatch: "OAuth security check failed (state mismatch) — please try connecting again.",
  no_access_token_returned: "The provider did not return an access token.",
  no_organization: "No organization found to attach this integration to.",
};

function describeError(code: string | null): string | null {
  if (!code) return null;
  const [key, detail] = code.split(":");
  const base = ERROR_MESSAGES[key] ?? `Connection failed: ${code}`;
  return detail ? `${base} (${detail})` : base;
}

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: { error?: string; provider?: string; connected?: string; missing?: string };
}) {
  const [integrations, org] = await Promise.all([
    prisma.integration.findMany({ orderBy: { provider: "asc" } }),
    prisma.organization.findFirst(),
  ]);

  const byProvider = new Map(integrations.map((i) => [i.provider, i]));
  const errorText = describeError(searchParams.error ?? null);

  const oauthSlugs = Object.keys(OAUTH_PROVIDERS) as OAuthSlug[];
  const github = byProvider.get(IntegrationProvider.GITHUB);

  return (
    <main className="mx-auto min-h-screen max-w-5xl space-y-8 px-6 py-10">
      <div className="border-b border-hairline pb-6">
        <h1 className="display-heading text-display-lg text-ink-primary">Integrations</h1>
        <p className="mt-1 text-body-sm text-ink-secondary">
          Real OAuth connect/disconnect for Slack and Google (Gmail, Calendar, Drive).
          Seeded fixture data powers the demo until real credentials are supplied.
        </p>
      </div>

      {searchParams.connected && (
        <Surface tier={1} className="border-trajectory-positive/40 p-4 text-body-sm text-trajectory-positive">
          Connected {searchParams.connected} successfully.
        </Surface>
      )}
      {errorText && (
        <Surface tier={1} className="border-signal-risk/40 p-4 text-body-sm text-signal-risk">
          {errorText}
        </Surface>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {oauthSlugs.map((slug) => {
          const config = OAUTH_PROVIDERS[slug];
          const integration = byProvider.get(config.dbProvider) ?? null;
          const clientIdSet = Boolean(process.env[config.clientIdEnv]);
          const clientSecretSet = Boolean(process.env[config.clientSecretEnv]);
          const configured = clientIdSet && clientSecretSet;
          return (
            <IntegrationCard
              key={slug}
              slug={slug}
              displayName={config.displayName}
              configured={configured}
              missingEnvVar={!clientIdSet ? config.clientIdEnv : config.clientSecretEnv}
              integration={
                integration
                  ? {
                      id: integration.id,
                      provider: integration.provider,
                      mode: integration.mode,
                      status: integration.status,
                      lastSyncAt: integration.lastSyncAt,
                      externalAccountId: integration.externalAccountId,
                      lastError: integration.lastError,
                    }
                  : null
              }
            />
          );
        })}
      </div>

      {github && (
        <section className="space-y-3">
          <h2 className="display-heading text-display-sm text-ink-primary">Other connectors</h2>
          <Surface tier={1} className="flex items-center justify-between p-5">
            <div>
              <h3 className="text-body-lg font-medium text-ink-primary">GitHub</h3>
              <p className="text-body-sm text-ink-secondary">
                Seeded fixture data — no OAuth flow wired for this pass, per docs/SDD.md §2.
              </p>
            </div>
            <AuthorityBadge state="observed" />
          </Surface>
        </section>
      )}

      {!org && (
        <Surface tier={1} className="p-4 text-body-sm text-signal-risk">
          No organization found — run the seed script before connecting integrations.
        </Surface>
      )}
    </main>
  );
}
