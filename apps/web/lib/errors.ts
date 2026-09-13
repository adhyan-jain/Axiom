/** Narrow an unknown caught value to a safe display string without `any`. */
export function errorMessage(error: unknown, fallback = "Unknown error"): string {
  return error instanceof Error ? error.message : fallback;
}
