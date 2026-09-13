import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isOAuthSlug, OAUTH_PROVIDERS, requireProviderCredentials, ProviderNotConfiguredError } from "@/lib/oauthProviders";
import { encryptToken, IntegrationCryptoNotConfiguredError } from "@/lib/integrationCrypto";
import { errorMessage } from "@/lib/errors";

export const dynamic = "force-dynamic";

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  ok?: boolean; // Slack's oauth.v2.access wraps success in `ok`
  error?: string;
  authed_user?: { id?: string };
  team?: { id?: string };
  id_token?: string;
};

/**
 * GET /api/integrations/:provider/callback — validates the CSRF `state` param against
 * the httpOnly cookie set by the connect route, exchanges the authorization `code` for
 * tokens server-side (never in the browser), encrypts them at rest, and marks the
 * Integration row CONNECTED. Any failure (missing creds, state mismatch, token exchange
 * error) redirects back to /integrations with an error state — never a fake success.
 */
export async function GET(request: Request, { params }: { params: { provider: string } }) {
  const url = new URL(request.url);
  const origin = `${url.protocol}//${url.host}`;

  if (!isOAuthSlug(params.provider)) {
    return NextResponse.redirect(`${origin}/integrations?error=unknown_provider&provider=${params.provider}`);
  }
  const config = OAUTH_PROVIDERS[params.provider];
  const fail = (reason: string) =>
    NextResponse.redirect(`${origin}/integrations?error=${encodeURIComponent(reason)}&provider=${config.slug}`);

  const providerError = url.searchParams.get("error");
  if (providerError) {
    return fail(`provider_denied:${providerError}`);
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = request.headers
    .get("cookie")
    ?.split("; ")
    .find((c) => c.startsWith(`oauth_state_${config.slug}=`))
    ?.split("=")[1];

  if (!code || !state || !cookieState || state !== cookieState) {
    return fail("state_mismatch");
  }

  let clientId: string, clientSecret: string;
  try {
    ({ clientId, clientSecret } = requireProviderCredentials(config));
  } catch (error) {
    if (error instanceof ProviderNotConfiguredError) {
      return fail(`not_configured:${error.missingEnvVar}`);
    }
    throw error;
  }

  const redirectUri = `${origin}/api/integrations/${config.slug}/callback`;

  let tokenJson: TokenResponse;
  try {
    const tokenResponse = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    tokenJson = (await tokenResponse.json()) as TokenResponse;
    if (!tokenResponse.ok || tokenJson.error || (config.slug === "slack" && tokenJson.ok === false)) {
      return fail(`token_exchange_failed:${tokenJson.error ?? tokenResponse.status}`);
    }
  } catch (error) {
    return fail(`token_exchange_network_error:${errorMessage(error)}`);
  }

  if (!tokenJson.access_token) {
    return fail("no_access_token_returned");
  }

  try {
    const org = await prisma.organization.findFirst();
    if (!org) return fail("no_organization");

    const accessTokenEnc = encryptToken(tokenJson.access_token);
    const refreshTokenEnc = tokenJson.refresh_token ? encryptToken(tokenJson.refresh_token) : null;
    const externalAccountId = tokenJson.team?.id ?? tokenJson.authed_user?.id ?? null;

    await prisma.integration.upsert({
      where: { orgId_provider: { orgId: org.id, provider: config.dbProvider } },
      update: {
        mode: "LIVE",
        status: "CONNECTED",
        accessTokenEnc,
        refreshTokenEnc,
        tokenExpiresAt: tokenJson.expires_in ? new Date(Date.now() + tokenJson.expires_in * 1000) : null,
        scope: tokenJson.scope ?? config.scope,
        externalAccountId,
        lastError: null,
        lastSyncAt: new Date(),
      },
      create: {
        orgId: org.id,
        provider: config.dbProvider,
        mode: "LIVE",
        status: "CONNECTED",
        accessTokenEnc,
        refreshTokenEnc,
        tokenExpiresAt: tokenJson.expires_in ? new Date(Date.now() + tokenJson.expires_in * 1000) : null,
        scope: tokenJson.scope ?? config.scope,
        externalAccountId,
        lastSyncAt: new Date(),
      },
    });

    await prisma.auditLogEntry.create({
      data: {
        orgId: org.id,
        agent: "founder",
        action: `Connected ${config.displayName} via OAuth`,
        tool: "integration_oauth_connect",
        input: { provider: config.dbProvider },
        output: { externalAccountId },
        authorizationDecision: "allowed:manual",
        result: "success",
        verificationStatus: "unverified",
      },
    });

    const response = NextResponse.redirect(`${origin}/integrations?connected=${config.slug}`);
    response.cookies.delete(`oauth_state_${config.slug}`);
    return response;
  } catch (error) {
    if (error instanceof IntegrationCryptoNotConfiguredError) {
      return fail("token_encryption_not_configured:INTEGRATION_TOKEN_KEY");
    }
    return fail(`storage_failed:${errorMessage(error)}`);
  }
}
