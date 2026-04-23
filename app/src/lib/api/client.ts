export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type QueryValue = string | number | boolean | null | undefined;

interface ApiFetchOptions extends RequestInit {
  query?: Record<string, QueryValue>;
}

function buildPath(path: string, query?: Record<string, QueryValue>) {
  if (!query) {
    return path;
  }

  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) {
      searchParams.set(key, String(value));
    }
  }

  const queryString = searchParams.toString();
  if (!queryString) {
    return path;
  }

  return `${path}?${queryString}`;
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const { query, headers, body, ...init } = options;
  const isFormData =
    typeof FormData !== "undefined" && body instanceof FormData;

  const response = await fetch(buildPath(path, query), {
    ...init,
    body,
    headers: {
      ...(body && !isFormData ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
  });

  const contentType = response.headers.get("content-type") ?? "";
  const responseBody = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => "");

  if (!response.ok) {
    const message =
      typeof responseBody === "object" &&
      responseBody !== null &&
      "message" in responseBody
        ? String(responseBody.message)
        : "リクエストに失敗しました";

    throw new ApiError(message, response.status, responseBody);
  }

  return responseBody as T;
}
