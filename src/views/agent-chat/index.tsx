import React, { useEffect, useRef, useState } from "react";
import {
  Bubble,
  Sender,
  Welcome,
  Prompts,
  type BubbleItemType,
} from "@ant-design/x";
import { Typography, Button, Avatar } from "antd";
import {
  DeleteOutlined,
  RobotOutlined,
  UserOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { sendChatMessage } from "../../api/chat";
import AssistantMessageContent from "../../components/chat/AssistantMessageContent";
import type { AssistantMessage } from "../../store/useChatStore";
import { useChatStore } from "../../store/useChatStore";

const { Title, Text } = Typography;

const getErrorMessage = (error: unknown) => {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "已取消本次生成";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "流式消息处理失败";
};

const AgentChat: React.FC = () => {
  const navigate = useNavigate();
  const abortControllerRef = useRef<AbortController | null>(null);
  const [inputValue, setInputValue] = useState("");
  const {
    serverConversationId,
    messages,
    addUserMessage,
    addAssistantPlaceholder,
    bindServerConversationId,
    bindUserServerConversationId,
    bindAssistantServerMeta,
    appendAssistantMarkdown,
    replaceAssistantArtifact,
    completeAssistantMessage,
    failAssistantMessage,
    cancelAssistantMessage,
    setActiveArtifactId,
    clearHistory,
  } = useChatStore();

  const isStreaming = messages.some(
    (message) =>
      message.role === "assistant" &&
      (message.status === "pending" ||
        message.status === "accepted" ||
        message.status === "streaming"),
  );

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const handleOpenArtifact = (artifactId: string) => {
    setActiveArtifactId(artifactId);
    navigate("/cargo-3d");
  };

  const handleClearHistory = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    clearHistory();
  };

  const onSend = async (content: string) => {
    const trimmedContent = content.trim();
    if (!trimmedContent || isStreaming) {
      return;
    }

    const { localId: localUserMessageId, clientMessageId } =
      addUserMessage(trimmedContent);
    const localAssistantMessageId = addAssistantPlaceholder();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setInputValue("");
    let currentServerRequestId: string | undefined;
    let currentServerMessageId: string | undefined;
    const ensureAssistantServerBinding = (event: {
      requestId: string;
      messageId: string;
      conversationId: string;
      ts: string;
    }) => {
      currentServerRequestId ??= event.requestId;
      currentServerMessageId ??= event.messageId;
      bindServerConversationId(event.conversationId);
      bindAssistantServerMeta(localAssistantMessageId, {
        serverRequestId: event.requestId,
        serverMessageId: event.messageId,
        serverConversationId: event.conversationId,
        startedAt: event.ts,
      });
    };

    try {
      await sendChatMessage({
        serverConversationId,
        clientMessageId,
        text: trimmedContent,
        signal: controller.signal,
        onAccepted: (response) => {
          currentServerRequestId = response.requestId;
          bindServerConversationId(response.conversationId);
          bindUserServerConversationId(
            localUserMessageId,
            response.conversationId,
          );
          bindAssistantServerMeta(localAssistantMessageId, {
            serverRequestId: response.requestId,
            serverConversationId: response.conversationId,
          });
        },
        onEvent: (event) => {
          if (
            currentServerRequestId &&
            event.requestId !== currentServerRequestId
          ) {
            return;
          }

          if (event.type === "message.start") {
            ensureAssistantServerBinding(event);
            return;
          }

          ensureAssistantServerBinding(event);

          if (
            currentServerMessageId &&
            event.messageId !== currentServerMessageId
          ) {
            return;
          }

          if (event.type === "markdown.delta") {
            appendAssistantMarkdown(
              localAssistantMessageId,
              event.payload.delta,
            );
            return;
          }

          if (event.type === "artifact.replace") {
            replaceAssistantArtifact(
              localAssistantMessageId,
              event.payload.artifact,
            );
            return;
          }

          if (event.type === "message.done") {
            completeAssistantMessage(localAssistantMessageId, event.ts);
            return;
          }

          if (event.type === "message.error") {
            failAssistantMessage(
              localAssistantMessageId,
              event.payload.message,
            );
          }
        },
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        cancelAssistantMessage(localAssistantMessageId);
      } else {
        failAssistantMessage(localAssistantMessageId, getErrorMessage(error));
      }
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  };

  const bubbleItems: BubbleItemType[] = messages.map((message) => {
    if (message.role === "user") {
      return {
        key: message.id,
        content: (
          <div className="whitespace-pre-wrap text-[15px] leading-7">
            {message.text}
          </div>
        ),
        role: message.role,
        placement: "end",
        avatar: (
          <Avatar
            icon={<UserOutlined />}
            style={{ backgroundColor: "#1677ff" }}
          />
        ),
        variant: "filled",
      };
    }

    const assistantMessage = message as AssistantMessage;
    const hasArtifact = Object.keys(assistantMessage.artifacts).length > 0;

    return {
      key: message.id,
      content: (
        <AssistantMessageContent
          message={assistantMessage}
          onOpenArtifact={handleOpenArtifact}
        />
      ),
      role: message.role,
      placement: "start",
      avatar: (
        <Avatar
          icon={<RobotOutlined />}
          style={{ backgroundColor: "#0ea5e9" }}
        />
      ),
      loading:
        !message.markdownText &&
        !hasArtifact &&
        (message.status === "pending" ||
          message.status === "accepted" ||
          message.status === "streaming"),
      footer:
        message.status === "pending" ||
        message.status === "accepted" ||
        message.status === "streaming" ? (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <LoadingOutlined />
            <span>正在接收 SSE 流式内容和 3D 结构数据...</span>
          </div>
        ) : message.status === "cancelled" ? (
          <Text type="secondary" className="text-xs">
            已取消本次生成
          </Text>
        ) : undefined,
      variant: "shadow",
    };
  });

  return (
    <div className="flex h-full flex-col bg-[linear-gradient(180deg,#f8fbff_0%,#f6f8fb_100%)]">
      <div className="flex-1 overflow-hidden p-4">
        <div className="flex h-full w-full flex-col">
          {messages.length === 0 ? (
            <Welcome variant="borderless" title="AI 装箱助手" />
          ) : (
            <>
              <div className="mb-4 flex shrink-0 items-center justify-between px-2">
                <div>
                  <Title level={4} style={{ margin: 0 }}>
                    会话详情
                  </Title>
                  <Text type="secondary">
                    当前服务端会话 ID：
                    {serverConversationId ?? "等待后端创建"}
                  </Text>
                </div>
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={handleClearHistory}
                >
                  清除历史
                </Button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto">
                <Bubble.List
                  items={bubbleItems}
                  className="h-full"
                  autoScroll
                />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="border-t border-slate-200 bg-white/90 p-4 backdrop-blur">
        <div>
          <Sender
            value={inputValue}
            onChange={setInputValue}
            onSubmit={onSend}
            placeholder="输入自然语言需求，系统会通过 HTTP + SSE 返回 markdown 说明和 3D 结构数据..."
            loading={isStreaming}
          />
        </div>
      </div>
    </div>
  );
};

export default AgentChat;
