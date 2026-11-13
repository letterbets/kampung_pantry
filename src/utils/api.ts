/**
 * Safely fetches JSON from an API route and throws a human-readable
 * error if the server returns plain-text or HTML (such as a 404 page).
 */
export async function safeFetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const rawText = await response.text();
  const contentType = response.headers.get('content-type') || '';

  let parsed: unknown = null;
  if (rawText && (contentType.includes('application/json') || rawText.trim().startsWith('{') || rawText.trim().startsWith('['))) {
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = null;
    }
  }

  if (!response.ok) {
    const errorMsg =
      parsed && typeof parsed === 'object' && 'error' in parsed && typeof (parsed as { error?: unknown }).error === 'string'
        ? (parsed as { error: string }).error
        : `Server returned HTTP ${response.status}: ${rawText.slice(0, 120) || 'Unable to reach API route.'}`;
    throw new Error(errorMsg);
  }

  if (parsed === null) {
    throw new Error('The API returned an unexpected non-JSON response. Please check deployment routes.');
  }

  return parsed as T;
}
