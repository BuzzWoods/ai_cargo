import {
  EventStreamContentType,
  fetchEventSource,
} from "@microsoft/fetch-event-source";
import type {
  ChatInputFileRef,
  ChatPostAcceptedResponse,
  ChatPostRequest,
  ChatStreamEvent,
  StreamEventType,
} from "./protocol";

interface SendChatMessageOptions {
  serverConversationId: string | null;
  clientMessageId: string;
  text: string;
  files?: ChatInputFileRef[];
  signal?: AbortSignal;
  onAccepted?: (response: ChatPostAcceptedResponse) => void;
  onEvent: (event: ChatStreamEvent) => void;
}

interface ParsedStreamEventShape {
  type: StreamEventType;
  eventId: string;
  conversationId: string;
  requestId: string;
  messageId: string;
  seq: number;
  ts: string;
  payload: Record<string, unknown>;
}

const streamEventTypes: StreamEventType[] = [
  "message.start",
  "markdown.delta",
  "artifact.replace",
  "message.done",
  "message.error",
  "heartbeat",
];

const DEFAULT_CHAT_API_BASE_URL = "http://192.168.110.64:9411";
const chatApiBaseUrl = (
  import.meta.env.VITE_CHAT_API_BASE_URL ?? DEFAULT_CHAT_API_BASE_URL
).replace(/\/+$/, "");

const createApiUrl = (pathOrUrl: string) =>
  new URL(pathOrUrl, `${chatApiBaseUrl}/`).toString();

const isKnownStreamEvent = (
  value: unknown,
): value is ParsedStreamEventShape => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.eventId === "string" &&
    typeof record.conversationId === "string" &&
    typeof record.requestId === "string" &&
    typeof record.messageId === "string" &&
    typeof record.seq === "number" &&
    typeof record.ts === "string" &&
    typeof record.type === "string" &&
    streamEventTypes.includes(record.type as StreamEventType) &&
    !!record.payload &&
    typeof record.payload === "object"
  );
};

const isAcceptedResponse = (
  value: unknown,
): value is ChatPostAcceptedResponse => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    record.accepted === true &&
    typeof record.conversationId === "string" &&
    typeof record.requestId === "string" &&
    typeof record.sseChannel === "string"
  );
};

const unwrapApiResponseData = (value: unknown) => {
  if (!value || typeof value !== "object") {
    return value;
  }

  const record = value as Record<string, unknown>;

  return "data" in record ? record.data : value;
};

const getResponseErrorMessage = async (response: Response) => {
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

const postChatMessage = async (
  requestBody: ChatPostRequest,
  signal?: AbortSignal,
) => {
  const response = await fetch(createApiUrl("/api/chat/messages"), {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`发送消息失败: ${await getResponseErrorMessage(response)}`);
  }

  const data = unwrapApiResponseData((await response.json()) as unknown);
  if (!isAcceptedResponse(data)) {
    throw new Error("后端 accepted 响应格式不正确");
  }

  return data;
};

export const sendChatMessage = async ({
  serverConversationId,
  clientMessageId,
  text,
  files,
  signal,
  onAccepted,
  onEvent,
}: SendChatMessageOptions): Promise<ChatPostAcceptedResponse> => {
  const acceptedResponse = await postChatMessage(
    {
      conversationId: serverConversationId,
      clientMessageId,
      text,
      ...(files?.length ? { files } : {}),
      context: {
        bizType: "cargo_packing",
        mode: "new_plan",
        hints: {},
      },
    },
    signal,
  );

  onAccepted?.(acceptedResponse);

  let sawTerminalEvent = false;
  const seenEventIds = new Set<string>();
  let latestSeq = 0;

  await fetchEventSource(createApiUrl(acceptedResponse.sseChannel), {
    method: "GET",
    signal,
    openWhenHidden: true,
    headers: {
      Accept: EventStreamContentType,
    },
    async onopen(response) {
      if (!response.ok) {
        throw new Error(
          `SSE 连接失败: ${await getResponseErrorMessage(response)}`,
        );
      }

      const contentType = response.headers.get("content-type");
      if (!contentType?.includes(EventStreamContentType)) {
        throw new Error("SSE 返回的 Content-Type 不正确");
      }
    },
    onmessage(message) {
      if (!message.data) {
        return;
      }

      const parsed = JSON.parse(message.data) as unknown;
      if (!isKnownStreamEvent(parsed)) {
        throw new Error("收到无法识别的 SSE 事件格式");
      }

      if (message.event && message.event !== parsed.type) {
        throw new Error("SSE 事件名与数据体 type 不一致");
      }

      // 页面切后台再回来时，fetch-event-source 可能触发重连。
      // 这里按 eventId / seq 去重，避免旧 delta 再次 append。
      if (seenEventIds.has(parsed.eventId) || parsed.seq <= latestSeq) {
        return;
      }

      seenEventIds.add(parsed.eventId);
      latestSeq = parsed.seq;

      if (parsed.type === "message.done" || parsed.type === "message.error") {
        sawTerminalEvent = true;
      }

      onEvent(parsed as unknown as ChatStreamEvent);
    },
    onclose() {
      if (!signal?.aborted && !sawTerminalEvent) {
        throw new Error("SSE 在 message.done 前提前关闭");
      }
    },
    onerror(error) {
      throw error;
    },
  });

  return acceptedResponse;
};
