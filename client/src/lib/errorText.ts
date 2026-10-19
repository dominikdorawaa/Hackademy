export function errorText(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
