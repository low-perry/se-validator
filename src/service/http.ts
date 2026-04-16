import type { ServiceCheck, ServiceCheckExecution, QueryParamValue } from "./types.js";

export async function executeServiceCheck(artifactPath: string, check: ServiceCheck): Promise<ServiceCheckExecution> {
  const url = buildRequestUrl(check.request.url, check.request.params);
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), check.request.timeoutMs ?? 8000);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        ...check.request.headers
      },
      signal: controller.signal
    });
    const durationMs = Date.now() - startedAt;
    const text = await response.text();

    let data: unknown = text;
    if (text.trim() !== "") {
      try {
        data = JSON.parse(text) as unknown;
      } catch {
        data = text;
      }
    }

    return {
      artifactPath,
      checkName: check.name,
      endpoint: check.endpoint,
      url,
      status: response.status,
      durationMs,
      data,
      error: undefined
    };
  } catch (error) {
    return {
      artifactPath,
      checkName: check.name,
      endpoint: check.endpoint,
      url,
      status: undefined,
      durationMs: Date.now() - startedAt,
      data: undefined,
      error: error instanceof Error ? error.message : "Request failed."
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function buildRequestUrl(url: string, params: Record<string, QueryParamValue> | undefined): string {
  const requestUrl = new URL(url);

  for (const [key, value] of Object.entries(params ?? {})) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        requestUrl.searchParams.append(key, String(entry));
      }
      continue;
    }

    requestUrl.searchParams.set(key, String(value));
  }

  return requestUrl.toString();
}
