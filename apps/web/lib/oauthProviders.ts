/**
 * OAuth provider configuration for real Slack / Google (Gmail, Calendar, Drive) connect
 * flows. Per docs/SDD.md §2.3/§3: connectors ship with a Seeded implementation now and a
 * Live implementation that's real code, gated on credential presence — never a fake
 * "looks connected" UI. This module is the single source of truth for each provider's
 * auth/token URLs, scopes, and env var names, used by both the connect and callback
 * routes below.
 */
import { IntegrationProvider } from "@prisma/client";

export type OAuthSlug = "slack" | "gmail" | "calendar" | "drive";

export type OAuthProviderConfig = {
  slug: OAuthSlug;
  dbProvider: IntegrationProvider;
  displayName: string;
  authUrl: string;
  tokenUrl: string;
  scope: string;
  clientIdEnv: "SLACK_CLIENT_ID" | "GOOGLE_CLIENT_ID";
  clientSecretEnv: "SLACK_CLIENT_SECRET" | "GOOGLE_CLIENT_SECRET";
};

export const OAUTH_PROVIDERS: Record<OAuthSlug, OAuthProviderConfig> = {
  slack: {
    slug: "slack",
    dbProvider: IntegrationProvider.SLACK,
    displayName: "Slack",
    authUrl: "https://slack.com/oauth/v2/authorize",
    tokenUrl: "https://slack.com/api/oauth.v2.access",
    scope: "channels:read,chat:write,users:read",
    clientIdEnv: "SLACK_CLIENT_ID",
    clientSecretEnv: "SLACK_CLIENT_SECRET",
  },
  gmail: {
    slug: "gmail",
    dbProvider: IntegrationProvider.GMAIL,
    displayName: "Gmail",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scope: "https://www.googleapis.com/auth/gmail.readonly",
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
  },
  calendar: {
    slug: "calendar",
    dbProvider: IntegrationProvider.CALENDAR,
    displayName: "Calendar",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scope: "https://www.googleapis.com/auth/calendar.readonly",
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
  },
  drive: {
    slug: "drive",
    dbProvider: IntegrationProvider.DRIVE,
    displayName: "Drive",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scope: "https://www.googleapis.com/auth/drive.readonly",
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
  },
};

export function isOAuthSlug(value: string): value is OAuthSlug {
  return value in OAUTH_PROVIDERS;
}

export class ProviderNotConfiguredError extends Error {
  constructor(public readonly missingEnvVar: string) {
    super(`Integration not configured — add ${missingEnvVar} to .env`);
    this.name = "ProviderNotConfiguredError";
  }
}

/** Throws ProviderNotConfiguredError if either client id or secret is missing/blank. */
export function requireProviderCredentials(config: OAuthProviderConfig): { clientId: string; clientSecret: string } {
  const clientId = process.env[config.clientIdEnv];
  const clientSecret = process.env[config.clientSecretEnv];
  if (!clientId) throw new ProviderNotConfiguredError(config.clientIdEnv);
  if (!clientSecret) throw new ProviderNotConfiguredError(config.clientSecretEnv);
  return { clientId, clientSecret };
}
