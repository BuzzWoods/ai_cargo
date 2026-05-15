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
import {
  createApiUrl,
  getResponseErrorMessage,
  unwrapApiResponseData,
} from "./http";

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

const enableSseDebug = import.meta.env.DEV;

// SSE 是文本流，运行时仍要做结构校验，避免后端异常数据直接污染聊天状态。
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

// HTTP 发消息只代表后端“接受任务”，真正的正文和 3D artifact 会从 SSE 继续回来。
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

// 第一步：用 HTTP POST 把用户输入发给后端，拿到 conversation/request 和 SSE 通道。
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

// 开发环境把每个 SSE 事件打到控制台，方便排查“页面有内容但 Network EventStream 看不到”的情况。
const logSseEvent = (event: ChatStreamEvent) => {
  if (!enableSseDebug) {
    return;
  }

  console.debug("[SSE event]", {
    type: event.type,
    seq: event.seq,
    eventId: event.eventId,
    conversationId: event.conversationId,
    requestId: event.requestId,
    messageId: event.messageId,
    payload: event.payload,
  });
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
  // 第二步：POST 成功后，立刻建立 SSE GET 连接继续接收增量结果。
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

  // 第三步：SSE 连接生命周期都在这里处理，包括打开校验、消息解析、去重和异常关闭。
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

      const streamEvent = parsed as unknown as ChatStreamEvent;
      logSseEvent(streamEvent);
      onEvent(streamEvent);
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
