const DEFAULT_API_BASE_URL = "http://192.168.110.64:9411";

// API 基础地址统一从这里生成，方便本地/测试/生产只改环境变量。
export const apiBaseUrl = (
  import.meta.env.VITE_CHAT_API_BASE_URL ?? DEFAULT_API_BASE_URL
).replace(/\/+$/, "");

export const createApiUrl = (pathOrUrl: string) =>
  new URL(pathOrUrl, `${apiBaseUrl}/`).toString();

// 后端有些接口会包一层 { data }，有些调试数据可能直接返回实体；这里统一拆出来。
export const unwrapApiResponseData = (value: unknown) => {
  if (!value || typeof value !== "object") {
    return value;
  }

  const record = value as Record<string, unknown>;

  return "data" in record ? record.data : value;
};

// fetch 出错时尽量读取后端 JSON 里的 message/msg/code，避免页面只显示 HTTP 状态码。
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
