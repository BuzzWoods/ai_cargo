const DEFAULT_API_BASE_URL = "http://192.168.110.64:9411";

export const apiBaseUrl = (
  import.meta.env.VITE_CHAT_API_BASE_URL ?? DEFAULT_API_BASE_URL
).replace(/\/+$/, "");

export const createApiUrl = (pathOrUrl: string) =>
  new URL(pathOrUrl, `${apiBaseUrl}/`).toString();

export const unwrapApiResponseData = (value: unknown) => {
  if (!value || typeof value !== "object") {
    return value;
  }

  const record = value as Record<string, unknown>;

  return "data" in record ? record.data : value;
};

export const getResponseErrorMessage = async (response: Response) => {
  const text = await response.text();

  if (!text) {
    return `HTTP ${response.status}`;
  }

  try {
    const parsed = JSON.parse(text) as {
      message?: string;
      error?: string;
      msg?: string;
      code?: string;
    };

    return parsed.message ?? parsed.error ?? parsed.msg ?? parsed.code ?? text;
  } catch {
    return text;
  }
};
