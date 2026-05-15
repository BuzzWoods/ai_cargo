import { create } from "zustand";
import type {
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
  appendAssistantMarkdown: (id: string, delta: string) => void;
  replaceAssistantArtifact: (
    id: string,
    artifact: CargoPackingPlansArtifact,
  ) => void;
  completeAssistantMessage: (id: string, finishedAt?: string) => void;
  failAssistantMessage: (id: string, error: string) => void;
  cancelAssistantMessage: (id: string) => void;
  setActiveArtifactId: (artifactId: string | null) => void;
  clearHistory: () => void;
}

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

export const useChatStore = create<ChatState>((set) => ({
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
        serverRequestId:
          meta.serverRequestId ?? message.serverRequestId,
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
  appendAssistantMarkdown: (id, delta) => {
    // markdown.delta 是增量文本，必须 append；SSE 去重在 api/chat.ts 做。
    set((state) => ({
      messages: updateAssistantMessage(state.messages, id, (message) => ({
        ...message,
        status: "streaming",
        markdownText: `${message.markdownText}${delta}`,
      })),
    }));
  },
  replaceAssistantArtifact: (id, artifact) => {
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
}));
