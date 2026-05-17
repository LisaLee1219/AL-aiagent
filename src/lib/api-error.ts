/** Read `{ error: string }` from a failed API response. */
export async function readApiErrorMessage(
  res: Response,
  fallback: string,
): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    if (data.error?.trim()) return data.error.trim();
  } catch {
    // response body was not JSON
  }
  return `${fallback} (HTTP ${res.status})`;
}
