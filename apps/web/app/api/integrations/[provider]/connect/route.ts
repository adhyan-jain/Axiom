import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { isOAuthSlug, OAUTH_PROVIDERS, requireProviderCredentials, ProviderNotConfiguredError } from "@/lib/oauthProviders";

export const dynamic = "force-dynamic";

/**
 * GET /api/integrations/:provider/connect — starts the real OAuth flow. A plain link
 * (not a Server Action) since it must redirect the browser to the provider's own auth
 * page; no internal secret is involved or exposed here, only the provider's public
 * client id and a CSRF state we generate ourselves.
 *
 * Fails gracefully when SLACK_CLIENT_ID/SECRET or GOOGLE_CLIENT_ID/SECRET are missing:
 * redirects back to /integrations with an error state instead of pretending to connect.
 */
export async function GET(request: Request, { params }: { params: { provider: string } }) {
  const url = new URL(request.url);
  const origin = `${url.protocol}//${url.host}`;

  if (!isOAuthSlug(params.provider)) {
    return NextResponse.redirect(`${origin}/integrations?error=unknown_provider&provider=${params.provider}`);
  }
  const config = OAUTH_PROVIDERS[params.provider];

  let clientId: string;
  try {
    ({ clientId } = requireProviderCredentials(config));
  } catch (error) {
    if (error instanceof ProviderNotConfiguredError) {
      return NextResponse.redirect(
        `${origin}/integrations?error=not_configured&provider=${config.slug}&missing=${error.missingEnvVar}`
      );
    }
    throw error;
  }

  const state = crypto.randomBytes(24).toString("hex");
  const redirectUri = `${origin}/api/integrations/${config.slug}/callback`;

  const authUrl = new URL(config.authUrl);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", config.scope);
  authUrl.searchParams.set("state", state);
  if (config.slug !== "slack") {
    // Google-specific params for a refresh token on first consent.
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
  }

  const response = NextResponse.redirect(authUrl.toString());
  response.cookies.set(`oauth_state_${config.slug}`, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes — just long enough for the provider consent screen
    path: "/",
  });
  return response;
}
