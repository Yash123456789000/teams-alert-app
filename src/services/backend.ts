const REQUEST_TIMEOUT_MS = 15000;

/** "https://host/ " + "/api/x" -> "https://host/api/x". Throws on an unusable base URL. */
export function buildUrl(backendUrl: string, path: string): string {
  const base = backendUrl.trim().replace(/\/+$/, '');
  if (!/^https?:\/\/.+/i.test(base)) {
    throw new Error('Backend URL must start with http:// or https://');
  }
  return `${base}${path}`;
}

async function postJson(url: string, body: unknown): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', Accept: 'application/json'},
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      let detail = '';
      try {
        detail = (await response.text()).trim().slice(0, 200);
      } catch {
        // body unreadable; the status code alone will have to do
      }
      throw new Error(
        `Server responded ${response.status}${detail ? `: ${detail}` : ''}`,
      );
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/** POST <backend>/api/register  { secret, token } */
export function registerDevice(
  backendUrl: string,
  secret: string,
  token: string,
): Promise<void> {
  return postJson(buildUrl(backendUrl, '/api/register'), {secret, token});
}

/** POST <backend>/api/notify  { secret, sender, message } -- triggers a push to this device. */
export function sendTestAlert(backendUrl: string, secret: string): Promise<void> {
  return postJson(buildUrl(backendUrl, '/api/notify'), {
    secret,
    sender: 'Test Sender',
    message: 'This is a test alert from the Teams Alert app.',
  });
}
