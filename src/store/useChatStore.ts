import { create } from "zustand";
import type {
  CargoLayoutArtifact,
  MessageStatus,
} from "../api/protocol";

const createId = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;

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
  artifacts: Record<string, CargoLayoutArtifact>;
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
  replaceAssistantArtifact: (id: string, artifact: CargoLayoutArtifact) => void;
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
    set((state) => ({
      messages: updateAssistantMessage(state.messages, id, (message) => ({
        ...message,
        status: "streaming",
        markdownText: `${message.markdownText}${delta}`,
      })),
    }));
  },
  replaceAssistantArtifact: (id, artifact) => {
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
