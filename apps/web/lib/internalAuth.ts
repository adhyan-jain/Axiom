/**
 * Shared internal-auth check for every Next.js API route that should only be reachable
 * by trusted internal callers (agent-service callbacks, the demo runner, the app's own
 * client code via same-origin fetches carrying the shared secret).
 *
 * Fails CLOSED: if AGENT_SERVICE_SHARED_SECRET is unset/empty, every request is rejected.
 * Previously several routes fell back to `return true` when the secret was unset ("dev
 * default fallback") — that's a fail-OPEN bug: an unset env var silently disabled auth
 * entirely, contradicting the "authority never silently lapses" principle in
 * docs/DECISIONS.md. `apps/web/app/api/demo/run/route.ts` already had the correct
 * fail-closed check; this helper generalizes that pattern so it can't drift per-route again.
 */
import "server-only";

const INTERNAL_SECRET = process.env.AGENT_SERVICE_SHARED_SECRET;

export const INTERNAL_SECRET_HEADER = "X-Axiom-Internal-Secret";

/** Returns true only if AGENT_SERVICE_SHARED_SECRET is set AND matches the request header. */
export function checkInternalAuth(request: Request): boolean {
  if (!INTERNAL_SECRET) return false; // Fail-closed per DECISIONS.md security standards
  const header = request.headers.get(INTERNAL_SECRET_HEADER);
  return header === INTERNAL_SECRET;
}
