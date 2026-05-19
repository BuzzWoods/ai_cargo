import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  AssistantContentBlock,
  CargoPackingPlansArtifact,
  MessageStatus,
} from "../api/protocol";

// crypto.randomUUID 在部分 WebView/旧浏览器不可用，所以这里做了逐级降级。
const createUuid = () => {
  const webCrypto = globalThis.crypto;

  if (typeof webCrypto?.randomUUID === "function") {
    return webCrypto.randomUUID();
  }

  if (typeof webCrypto?.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    webCrypto.getRandomValues(bytes);

    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));

    return [
      hex.slice(0, 4).join(""),
      hex.slice(4, 6).join(""),
      hex.slice(6, 8).join(""),
      hex.slice(8, 10).join(""),
      hex.slice(10, 16).join(""),
    ].join("-");
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
};

const createId = (prefix: string) => `${prefix}_${createUuid()}`;

const CHAT_CACHE_STORAGE_KEY = "ai-cargo-chat-cache";
const CHAT_CACHE_VERSION = 1;
const MAX_CACHED_MESSAGES = 50;

export interface UserMessage {
  id: string;
  clientMessageId: string;
  role: "user";
  text: string;
  status: "done";
  timestamp: number;
  serverConversationId?: string;
}

export interface AssistantMessage {
  id: string;
  role: "assistant";
  status: MessageStatus;
  markdownText: string;
  artifacts: Record<string, CargoPackingPlansArtifact>;
  contentBlocks: AssistantContentBlock[];
  timestamp: number;
  serverRequestId?: string;
  serverMessageId?: string;
  serverConversationId?: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
}

export type ChatMessage = UserMessage | AssistantMessage;

interface ChatState {
  serverConversationId: string | null;
  activeArtifactId: string | null;
  messages: ChatMessage[];
  addUserMessage: (
    text: string,
  ) => { localId: string; clientMessageId: string };
  addAssistantPlaceholder: () => string;
  bindServerConversationId: (serverConversationId: string) => void;
  bindUserServerConversationId: (
    id: string,
    serverConversationId: string,
  ) => void;
  bindAssistantServerMeta: (
    id: string,
    meta: {
      serverRequestId?: string;
      serverMessageId?: string;
      serverConversationId?: string;
      startedAt?: string;
    },
  ) => void;
  appendAssistantMarkdown: (id: string, delta: string, seq: number) => void;
  replaceAssistantArtifact: (
    id: string,
    artifact: CargoPackingPlansArtifact,
    seq: number,
  ) => void;
  completeAssistantMessage: (id: string, finishedAt?: string) => void;
  failAssistantMessage: (id: string, error: string) => void;
  cancelAssistantMessage: (id: string) => void;
  setActiveArtifactId: (artifactId: string | null) => void;
  clearHistory: () => void;
}

type CachedChatState = Pick<
  ChatState,
  "activeArtifactId" | "messages" | "serverConversationId"
>;

const isUnfinishedAssistantStatus = (status: MessageStatus) =>
  status === "pending" || status === "accepted" || status === "streaming";

const isAssistantContentBlock = (
  value: unknown,
): value is AssistantContentBlock => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;

  if (record.type === "markdown") {
    return (
      typeof record.id === "string" &&
      typeof record.startSeq === "number" &&
      typeof record.endSeq === "number" &&
      typeof record.text === "string"
    );
  }

  return (
    record.type === "artifact" &&
    typeof record.id === "string" &&
    typeof record.seq === "number" &&
    typeof record.artifactId === "string"
  );
};

const getNormalizedContentBlocks = (
  message: AssistantMessage,
): AssistantContentBlock[] => {
  if (Array.isArray(message.contentBlocks)) {
    return message.contentBlocks.filter(isAssistantContentBlock);
  }

  const fallbackBlocks: AssistantContentBlock[] = [];

  if (message.markdownText) {
    fallbackBlocks.push({
      id: `${message.id}:markdown:fallback`,
      type: "markdown",
      startSeq: 0,
      endSeq: 0,
      text: message.markdownText,
    });
  }

  Object.keys(message.artifacts ?? {}).forEach((artifactId, index) => {
    fallbackBlocks.push({
      id: `${message.id}:artifact:${artifactId}`,
      type: "artifact",
      seq: index + 1,
      artifactId,
    });
  });

  return fallbackBlocks;
};

const appendMarkdownBlock = (
  message: AssistantMessage,
  delta: string,
  seq: number,
): AssistantContentBlock[] => {
  const contentBlocks = getNormalizedContentBlocks(message);
  const lastBlock = contentBlocks[contentBlocks.length - 1];
  const lastMarkdownBlock = lastBlock?.type === "markdown" ? lastBlock : null;

  if (lastMarkdownBlock) {
    return contentBlocks.map((block) =>
      block.type === "markdown" && block.id === lastMarkdownBlock.id
        ? {
            ...block,
            endSeq: seq,
            text: `${block.text}${delta}`,
          }
        : block,
    );
  }

  return [
    ...contentBlocks,
    {
      id: `${message.id}:markdown:${seq}`,
      type: "markdown",
      startSeq: seq,
      endSeq: seq,
      text: delta,
    },
  ];
};

const appendArtifactBlock = (
  message: AssistantMessage,
  artifactId: string,
  seq: number,
): AssistantContentBlock[] => {
  const contentBlocks = getNormalizedContentBlocks(message);

  if (
    contentBlocks.some(
      (block) => block.type === "artifact" && block.artifactId === artifactId,
    )
  ) {
    return contentBlocks;
  }

  return [
    ...contentBlocks,
    {
      id: `${message.id}:artifact:${artifactId}`,
      type: "artifact",
      seq,
      artifactId,
    },
  ];
};

const normalizeCachedMessages = (messages: ChatMessage[]) =>
  messages.slice(-MAX_CACHED_MESSAGES).map((message) => {
    if (message.role === "user") {
      return message;
    }

    // 刷新页面后 SSE 连接已经丢失，恢复时不能继续显示“正在生成”。
    if (isUnfinishedAssistantStatus(message.status)) {
      return {
        ...message,
        status: "cancelled",
        error: message.error ?? "页面刷新后已停止本次生成",
        contentBlocks: getNormalizedContentBlocks(message),
      } satisfies AssistantMessage;
    }

    return {
      ...message,
      artifacts: message.artifacts ?? {},
      markdownText: message.markdownText ?? "",
      contentBlocks: getNormalizedContentBlocks(message),
    } satisfies AssistantMessage;
  });

const normalizeCachedChatState = (value: unknown): CachedChatState => {
  const record =
    value && typeof value === "object"
      ? (value as Partial<CachedChatState>)
      : {};
  const messages = Array.isArray(record.messages)
    ? normalizeCachedMessages(record.messages)
    : [];

  return {
    activeArtifactId:
      typeof record.activeArtifactId === "string"
        ? record.activeArtifactId
        : null,
    messages,
    serverConversationId:
      typeof record.serverConversationId === "string"
        ? record.serverConversationId
        : null,
  };
};

const updateAssistantMessage = (
  messages: ChatMessage[],
  id: string,
  updater: (message: AssistantMessage) => AssistantMessage,
) =>
  // 所有 assistant 消息更新都走这个小工具，避免在多个 action 里重复 map/filter。
  messages.map((message) => {
    if (message.id !== id || message.role !== "assistant") {
      return message;
    }

    return updater(message);
  });

const updateUserMessage = (
  messages: ChatMessage[],
  id: string,
  updater: (message: UserMessage) => UserMessage,
) =>
  messages.map((message) => {
    if (message.id !== id || message.role !== "user") {
      return message;
    }

    return updater(message);
  });

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      serverConversationId: null,
      activeArtifactId: null,
      messages: [],
      addUserMessage: (text) => {
        // 用户消息先落本地，clientMessageId 会随 POST 发给后端做幂等/追踪。
        const id = createId("local_user");
        const clientMessageId = createId("client_msg");

        set((state) => ({
          messages: [
            ...state.messages,
            {
              id,
              clientMessageId,
              role: "user",
              text,
              status: "done",
              timestamp: Date.now(),
            },
          ],
        }));

        return { localId: id, clientMessageId };
      },
      addAssistantPlaceholder: () => {
        // 发起请求后先插入一个空 assistant 气泡，后续 SSE delta/artifact 会填充它。
        const id = createId("local_assistant");

        set((state) => ({
          messages: [
            ...state.messages,
            {
              id,
              role: "assistant",
              status: "pending",
              markdownText: "",
              artifacts: {},
              contentBlocks: [],
              timestamp: Date.now(),
            },
          ],
        }));

        return id;
      },
      bindServerConversationId: (serverConversationId) =>
        set({ serverConversationId }),
      bindUserServerConversationId: (id, serverConversationId) => {
        set((state) => ({
          messages: updateUserMessage(state.messages, id, (message) => ({
            ...message,
            serverConversationId,
          })),
        }));
      },
      bindAssistantServerMeta: (id, meta) => {
        set((state) => ({
          messages: updateAssistantMessage(state.messages, id, (message) => ({
            ...message,
            serverRequestId: meta.serverRequestId ?? message.serverRequestId,
            serverMessageId: meta.serverMessageId ?? message.serverMessageId,
            serverConversationId:
              meta.serverConversationId ?? message.serverConversationId,
            startedAt: meta.startedAt ?? message.startedAt,
            status:
              message.status === "done" || message.status === "error"
                ? message.status
                : "accepted",
          })),
        }));
      },
      appendAssistantMarkdown: (id, delta, seq) => {
        // markdown.delta 是增量文本，必须 append；SSE 去重在 api/chat.ts 做。
        set((state) => ({
          messages: updateAssistantMessage(state.messages, id, (message) => ({
            ...message,
            status: "streaming",
            markdownText: `${message.markdownText}${delta}`,
            contentBlocks: appendMarkdownBlock(message, delta, seq),
          })),
        }));
      },
      replaceAssistantArtifact: (id, artifact, seq) => {
        // artifact.replace 表示同一个 artifact id 的 3D 结构可被后端不断刷新。
        set((state) => ({
          activeArtifactId: artifact.id,
          messages: updateAssistantMessage(state.messages, id, (message) => ({
            ...message,
            status: "streaming",
            artifacts: {
              ...message.artifacts,
              [artifact.id]: artifact,
            },
            contentBlocks: appendArtifactBlock(message, artifact.id, seq),
          })),
        }));
      },
      completeAssistantMessage: (id, finishedAt) => {
        set((state) => ({
          messages: updateAssistantMessage(state.messages, id, (message) => ({
            ...message,
            status: "done",
            finishedAt,
          })),
        }));
      },
      failAssistantMessage: (id, error) => {
        set((state) => ({
          messages: updateAssistantMessage(state.messages, id, (message) => ({
            ...message,
            status: "error",
            error,
          })),
        }));
      },
      cancelAssistantMessage: (id) => {
        set((state) => ({
          messages: updateAssistantMessage(state.messages, id, (message) => ({
            ...message,
            status:
              message.status === "done" || message.status === "error"
                ? message.status
                : "cancelled",
          })),
        }));
      },
      setActiveArtifactId: (artifactId) => set({ activeArtifactId: artifactId }),
      clearHistory: () =>
        set({
          serverConversationId: null,
          activeArtifactId: null,
          messages: [],
        }),
    }),
    {
      name: CHAT_CACHE_STORAGE_KEY,
      version: CHAT_CACHE_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (state): CachedChatState => ({
        activeArtifactId: state.activeArtifactId,
        messages: normalizeCachedMessages(state.messages),
        serverConversationId: state.serverConversationId,
      }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...normalizeCachedChatState(persistedState),
      }),
    },
  ),
);
