interface ApiOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: FormData | Record<string, unknown>;
  headers?: Record<string, string>;
}

export function useApi() {
  const config = useRuntimeConfig();
  const requestHeaders = import.meta.server
    ? useRequestHeaders(["cookie"])
    : undefined;
  return <T>(path: string, options: ApiOptions = {}) =>
    $fetch<T>(path, {
      baseURL: config.public.apiBase,
      credentials: "include",
      headers: {
        "ngrok-skip-browser-warning": "true",
        ...requestHeaders,
        ...options.headers,
      },
      ...options,
    });
}

export function apiErrorMessage(error: unknown): string {
  const candidate = error as { data?: { message?: string }; message?: string };
  return candidate.data?.message ?? candidate.message ?? "Request failed";
}
