// One reviewed optional integration, never a blanket browser-error allowance.
export function classifyPluginBrowserDiagnostics(item, browser) {
  const errors = browser?.errors ?? [],
    requests = browser?.requests ?? [];
  const exactCodexProbe =
    item.catalogId === 3038 &&
    item.packageName === 'dsh-cost-meter' &&
    item.sourceRevision === 'ccdf958db8259b9bcd40dce9de9d9530bb747f0b' &&
    requests.length === 1 &&
    requests[0].status === 404 &&
    requests[0].url ===
      'http://127.0.0.1:4016/plugins/dsh-openai-codex/auth/status' &&
    errors.length === 1 &&
    errors[0] ===
      'Failed to load resource: the server responded with a status of 404 (Not Found)';
  return exactCodexProbe
    ? {
        errors: [],
        requests: [],
        expectedResourceFailures: [
          {
            integration: 'dsh-openai-codex',
            path: '/plugins/dsh-openai-codex/auth/status',
            status: 404,
          },
        ],
      }
    : { errors, requests, expectedResourceFailures: [] };
}
