import { create } from "zustand";
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

const LEGACY_CHAT_CACHE_STORAGE_KEY = "ai-cargo-chat-cache";
const CHAT_HISTORY_INDEX_STORAGE_KEY = "ai-cargo-chat-history-index";
const CHAT_HISTORY_ACTIVE_STORAGE_KEY = "ai-cargo-chat-history-active";
const CHAT_HISTORY_SESSION_PREFIX = "ai-cargo-chat-history-session:";
const MAX_CACHED_MESSAGES = 50;
const MAX_HISTORY_CONVERSATIONS = 30;

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

export interface ChatHistoryIndexItem {
  localConversationId: string;
  serverConversationId: string | null;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  lastMessagePreview: string;
}

interface ChatHistorySession {
  localConversationId: string;
  serverConversationId: string | null;
  activeArtifactId: string | null;
  messages: ChatMessage[];
}

interface ActiveChatHistory {
  localConversationId: string;
}

interface ChatState {
  activeLocalConversationId: string;
  historyIndex: ChatHistoryIndexItem[];
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
  createNewConversation: () => string;
  loadConversation: (conversationId: string) => boolean;
  deleteConversation: (conversationId: string) => void;
}

type CachedChatState = Pick<
  ChatState,
  "activeArtifactId" | "messages" | "serverConversationId"
>;

const canUseLocalStorage = () => typeof localStorage !== "undefined";

const readJson = <T,>(key: string): T | null => {
  if (!canUseLocalStorage()) {
    return null;
  }

  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

const writeJson = (key: string, value: unknown) => {
  if (!canUseLocalStorage()) {
    return;
  }

  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage 写满时不能影响聊天主链路。
  }
};

const removeStorageItem = (key: string) => {
  if (!canUseLocalStorage()) {
    return;
  }

  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
};

const getSessionStorageKey = (localConversationId: string) =>
  `${CHAT_HISTORY_SESSION_PREFIX}${localConversationId}`;

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
  const source =
    value &&
    typeof value === "object" &&
    "state" in value &&
    value.state &&
    typeof value.state === "object"
      ? (value.state as Partial<CachedChatState>)
      : value && typeof value === "object"
        ? (value as Partial<CachedChatState>)
        : {};
  const messages = Array.isArray(source.messages)
    ? normalizeCachedMessages(source.messages)
    : [];

  return {
    activeArtifactId:
      typeof source.activeArtifactId === "string"
        ? source.activeArtifactId
        : null,
    messages,
    serverConversationId:
      typeof source.serverConversationId === "string"
        ? source.serverConversationId
        : null,
  };
};

const normalizeHistoryIndex = (value: unknown): ChatHistoryIndexItem[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is ChatHistoryIndexItem => {
      const record = item as Partial<ChatHistoryIndexItem>;
      return (
        typeof record.localConversationId === "string" &&
        (typeof record.serverConversationId === "string" ||
          record.serverConversationId === null) &&
        typeof record.title === "string" &&
        typeof record.createdAt === "number" &&
        typeof record.updatedAt === "number" &&
        typeof record.messageCount === "number" &&
        typeof record.lastMessagePreview === "string"
      );
    })
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_HISTORY_CONVERSATIONS);
};

const normalizeHistorySession = (
  value: unknown,
  fallbackLocalConversationId: string,
): ChatHistorySession => {
  const record =
    value && typeof value === "object"
      ? (value as Partial<ChatHistorySession>)
      : {};
  const messages = Array.isArray(record.messages)
    ? normalizeCachedMessages(record.messages)
    : [];

  return {
    localConversationId:
      typeof record.localConversationId === "string"
        ? record.localConversationId
        : fallbackLocalConversationId,
    serverConversationId:
      typeof record.serverConversationId === "string"
        ? record.serverConversationId
        : null,
    activeArtifactId:
      typeof record.activeArtifactId === "string"
        ? record.activeArtifactId
        : null,
    messages,
  };
};

const getMessageText = (message: ChatMessage) => {
  if (message.role === "user") {
    return message.text;
  }

  return message.markdownText || message.error || "";
};

const getPreviewText = (text: string, maxLength: number) => {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength)}...`;
};

const createIndexItemFromSession = (
  session: ChatHistorySession,
  existing?: ChatHistoryIndexItem,
): ChatHistoryIndexItem | null => {
  if (session.messages.length === 0) {
    return null;
  }

  const firstUserMessage = session.messages.find(
    (message): message is UserMessage => message.role === "user",
  );
  const lastMessage = session.messages[session.messages.length - 1];
  const firstTimestamp = session.messages[0]?.timestamp ?? Date.now();
  const lastTimestamp = lastMessage?.timestamp ?? Date.now();
  const title = firstUserMessage
    ? getPreviewText(firstUserMessage.text, 20)
    : "新对话";

  return {
    localConversationId: session.localConversationId,
    serverConversationId: session.serverConversationId,
    title,
    createdAt: existing?.createdAt ?? firstTimestamp,
    updatedAt: Math.max(existing?.updatedAt ?? 0, lastTimestamp, Date.now()),
    messageCount: session.messages.length,
    lastMessagePreview: getPreviewText(getMessageText(lastMessage), 40),
  };
};

const readSession = (localConversationId: string) =>
  normalizeHistorySession(
    readJson<ChatHistorySession>(getSessionStorageKey(localConversationId)),
    localConversationId,
  );

const persistSessionSnapshot = (
  session: ChatHistorySession,
  historyIndex: ChatHistoryIndexItem[],
) => {
  writeJson(CHAT_HISTORY_ACTIVE_STORAGE_KEY, {
    localConversationId: session.localConversationId,
  } satisfies ActiveChatHistory);

  const existing = historyIndex.find(
    (item) => item.localConversationId === session.localConversationId,
  );
  const indexItem = createIndexItemFromSession(session, existing);
  let nextIndex = historyIndex.filter(
    (item) => item.localConversationId !== session.localConversationId,
  );

  if (indexItem) {
    writeJson(getSessionStorageKey(session.localConversationId), session);
    nextIndex = [indexItem, ...nextIndex];
  } else {
    removeStorageItem(getSessionStorageKey(session.localConversationId));
  }

  nextIndex = nextIndex
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_HISTORY_CONVERSATIONS);

  writeJson(CHAT_HISTORY_INDEX_STORAGE_KEY, nextIndex);
  return nextIndex;
};

const persistCurrentState = (state: ChatState) => {
  const session: ChatHistorySession = {
    localConversationId: state.activeLocalConversationId,
    serverConversationId: state.serverConversationId,
    activeArtifactId: state.activeArtifactId,
    messages: normalizeCachedMessages(state.messages),
  };
  const previousLocalConversationIds = state.historyIndex.map(
    (item) => item.localConversationId,
  );
  const nextIndex = persistSessionSnapshot(session, state.historyIndex);
  const nextLocalConversationIds = new Set(
    nextIndex.map((item) => item.localConversationId),
  );

  previousLocalConversationIds.forEach((localConversationId) => {
    if (!nextLocalConversationIds.has(localConversationId)) {
      removeStorageItem(getSessionStorageKey(localConversationId));
    }
  });

  return nextIndex;
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

const createEmptySession = (localConversationId = createId("local_conv")) => ({
  localConversationId,
  serverConversationId: null,
  activeArtifactId: null,
  messages: [],
});

const loadInitialState = () => {
  const historyIndex = normalizeHistoryIndex(
    readJson<ChatHistoryIndexItem[]>(CHAT_HISTORY_INDEX_STORAGE_KEY),
  );
  const activeHistory = readJson<ActiveChatHistory>(
    CHAT_HISTORY_ACTIVE_STORAGE_KEY,
  );
  const activeLocalConversationId =
    typeof activeHistory?.localConversationId === "string"
      ? activeHistory.localConversationId
      : historyIndex[0]?.localConversationId;

  if (activeLocalConversationId) {
    const session = readSession(activeLocalConversationId);
    return {
      activeLocalConversationId: session.localConversationId,
      historyIndex,
      serverConversationId: session.serverConversationId,
      activeArtifactId: session.activeArtifactId,
      messages: session.messages,
    };
  }

  const legacyState = normalizeCachedChatState(
    readJson<unknown>(LEGACY_CHAT_CACHE_STORAGE_KEY),
  );

  if (legacyState.messages.length > 0 || legacyState.serverConversationId) {
    const migratedSession: ChatHistorySession = {
      localConversationId: createId("local_conv"),
      serverConversationId: legacyState.serverConversationId,
      activeArtifactId: legacyState.activeArtifactId,
      messages: legacyState.messages,
    };
    const migratedIndex = persistSessionSnapshot(migratedSession, []);

    return {
      activeLocalConversationId: migratedSession.localConversationId,
      historyIndex: migratedIndex,
      serverConversationId: migratedSession.serverConversationId,
      activeArtifactId: migratedSession.activeArtifactId,
      messages: migratedSession.messages,
    };
  }

  const emptySession = createEmptySession();

  return {
    activeLocalConversationId: emptySession.localConversationId,
    historyIndex,
    serverConversationId: null,
    activeArtifactId: null,
    messages: [],
  };
};

const initialState = loadInitialState();

export const useChatStore = create<ChatState>()((set, get) => ({
  ...initialState,
  addUserMessage: (text) => {
    // 用户消息先落本地，clientMessageId 会随 POST 发给后端做幂等/追踪。
    const id = createId("local_user");
    const clientMessageId = createId("client_msg");

    set((state) => {
      const nextState = {
        ...state,
        messages: [
          ...state.messages,
          {
            id,
            clientMessageId,
            role: "user" as const,
            text,
            status: "done" as const,
            timestamp: Date.now(),
          },
        ],
      };

      return {
        messages: nextState.messages,
        historyIndex: persistCurrentState(nextState),
      };
    });

    return { localId: id, clientMessageId };
  },
  addAssistantPlaceholder: () => {
    // 发起请求后先插入一个空 assistant 气泡，后续 SSE delta/artifact 会填充它。
    const id = createId("local_assistant");

    set((state) => {
      const nextState = {
        ...state,
        messages: [
          ...state.messages,
          {
            id,
            role: "assistant" as const,
            status: "pending" as const,
            markdownText: "",
            artifacts: {},
            contentBlocks: [],
            timestamp: Date.now(),
          },
        ],
      };

      return {
        messages: nextState.messages,
        historyIndex: persistCurrentState(nextState),
      };
    });

    return id;
  },
  bindServerConversationId: (serverConversationId) => {
    set((state) => {
      const nextState = {
        ...state,
        serverConversationId,
      };

      return {
        serverConversationId,
        historyIndex: persistCurrentState(nextState),
      };
    });
  },
  bindUserServerConversationId: (id, serverConversationId) => {
    set((state) => {
      const nextState = {
        ...state,
        messages: updateUserMessage(state.messages, id, (message) => ({
          ...message,
          serverConversationId,
        })),
      };

      return {
        messages: nextState.messages,
        historyIndex: persistCurrentState(nextState),
      };
    });
  },
  bindAssistantServerMeta: (id, meta) => {
    set((state) => {
      const nextState = {
        ...state,
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
      };

      return {
        messages: nextState.messages,
        historyIndex: persistCurrentState(nextState),
      };
    });
  },
  appendAssistantMarkdown: (id, delta, seq) => {
    // markdown.delta 是增量文本，必须 append；SSE 去重在 api/chat.ts 做。
    set((state) => {
      const nextState = {
        ...state,
        messages: updateAssistantMessage(state.messages, id, (message) => ({
          ...message,
          status: "streaming",
          markdownText: `${message.markdownText}${delta}`,
          contentBlocks: appendMarkdownBlock(message, delta, seq),
        })),
      };

      return {
        messages: nextState.messages,
        historyIndex: persistCurrentState(nextState),
      };
    });
  },
  replaceAssistantArtifact: (id, artifact, seq) => {
    // artifact.replace 表示同一个 artifact id 的 3D 结构可被后端不断刷新。
    set((state) => {
      const nextState = {
        ...state,
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
      };

      return {
        activeArtifactId: nextState.activeArtifactId,
        messages: nextState.messages,
        historyIndex: persistCurrentState(nextState),
      };
    });
  },
  completeAssistantMessage: (id, finishedAt) => {
    set((state) => {
      const nextState = {
        ...state,
        messages: updateAssistantMessage(state.messages, id, (message) => ({
          ...message,
          status: "done",
          finishedAt,
        })),
      };

      return {
        messages: nextState.messages,
        historyIndex: persistCurrentState(nextState),
      };
    });
  },
  failAssistantMessage: (id, error) => {
    set((state) => {
      const nextState = {
        ...state,
        messages: updateAssistantMessage(state.messages, id, (message) => ({
          ...message,
          status: "error",
          error,
        })),
      };

      return {
        messages: nextState.messages,
        historyIndex: persistCurrentState(nextState),
      };
    });
  },
  cancelAssistantMessage: (id) => {
    set((state) => {
      const nextState = {
        ...state,
        messages: updateAssistantMessage(state.messages, id, (message) => ({
          ...message,
          status:
            message.status === "done" || message.status === "error"
              ? message.status
              : "cancelled",
        })),
      };

      return {
        messages: nextState.messages,
        historyIndex: persistCurrentState(nextState),
      };
    });
  },
  setActiveArtifactId: (artifactId) => {
    set((state) => {
      const nextState = {
        ...state,
        activeArtifactId: artifactId,
      };

      return {
        activeArtifactId: artifactId,
        historyIndex: persistCurrentState(nextState),
      };
    });
  },
  createNewConversation: () => {
    const session = createEmptySession();
    writeJson(CHAT_HISTORY_ACTIVE_STORAGE_KEY, {
      localConversationId: session.localConversationId,
    } satisfies ActiveChatHistory);

    set({
      activeLocalConversationId: session.localConversationId,
      serverConversationId: null,
      activeArtifactId: null,
      messages: [],
    });

    return session.localConversationId;
  },
  loadConversation: (conversationId) => {
    const state = get();
    const target = state.historyIndex.find(
      (item) =>
        item.localConversationId === conversationId ||
        item.serverConversationId === conversationId,
    );

    if (!target) {
      return false;
    }

    const session = readSession(target.localConversationId);
    writeJson(CHAT_HISTORY_ACTIVE_STORAGE_KEY, {
      localConversationId: session.localConversationId,
    } satisfies ActiveChatHistory);

    set({
      activeLocalConversationId: session.localConversationId,
      serverConversationId: session.serverConversationId,
      activeArtifactId: session.activeArtifactId,
      messages: session.messages,
    });

    return true;
  },
  deleteConversation: (conversationId) => {
    const state = get();
    const target = state.historyIndex.find(
      (item) =>
        item.localConversationId === conversationId ||
        item.serverConversationId === conversationId,
    );

    if (!target) {
      return;
    }

    removeStorageItem(getSessionStorageKey(target.localConversationId));
    const nextIndex = state.historyIndex.filter(
      (item) => item.localConversationId !== target.localConversationId,
    );
    writeJson(CHAT_HISTORY_INDEX_STORAGE_KEY, nextIndex);

    if (target.localConversationId !== state.activeLocalConversationId) {
      set({ historyIndex: nextIndex });
      return;
    }

    const nextActive = nextIndex[0];
    if (nextActive) {
      const session = readSession(nextActive.localConversationId);
      writeJson(CHAT_HISTORY_ACTIVE_STORAGE_KEY, {
        localConversationId: session.localConversationId,
      } satisfies ActiveChatHistory);

      set({
        activeLocalConversationId: session.localConversationId,
        historyIndex: nextIndex,
        serverConversationId: session.serverConversationId,
        activeArtifactId: session.activeArtifactId,
        messages: session.messages,
      });
      return;
    }

    const emptySession = createEmptySession();
    writeJson(CHAT_HISTORY_ACTIVE_STORAGE_KEY, {
      localConversationId: emptySession.localConversationId,
    } satisfies ActiveChatHistory);

    set({
      activeLocalConversationId: emptySession.localConversationId,
      historyIndex: [],
      serverConversationId: null,
      activeArtifactId: null,
      messages: [],
    });
  },
}));
