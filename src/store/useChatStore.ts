import { create } from 'zustand';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status?: 'loading' | 'done' | 'error';
  timestamp: number;
}

interface ChatState {
  messages: Message[];
  loading: boolean;
  addMessage: (message: Omit<Message, 'timestamp' | 'id'>) => string;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  clearHistory: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [
    {
      id: 'welcome',
      role: 'assistant',
      content: '你好！我是你的 AI 助手，有什么可以帮你的吗？',
      status: 'done',
      timestamp: Date.now(),
    },
  ],
  loading: false,
  addMessage: (msg) => {
    const id = Math.random().toString(36).substring(7);
    set((state) => ({
      messages: [
        ...state.messages,
        { ...msg, id, timestamp: Date.now() },
      ],
    }));
    return id;
  },
  updateMessage: (id, updates) => {
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === id ? { ...msg, ...updates } : msg
      ),
    }));
  },
  clearHistory: () => set({ messages: [] }),
}));
