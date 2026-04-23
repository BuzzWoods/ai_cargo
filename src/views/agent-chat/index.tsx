import React, { useEffect, useRef, useState } from "react";
import { Bubble, Sender, Welcome, type BubbleItemType } from "@ant-design/x";
import { Typography, Button } from "antd";
import {
  DeleteOutlined,
  LoadingOutlined,
  MoreOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { Dropdown, type MenuProps } from "antd";
import { sendChatMessage } from "../../api/chat";
import AssistantMessageContent from "../../components/chat/AssistantMessageContent";
import type { AssistantMessage } from "../../store/useChatStore";
import { useChatStore } from "../../store/useChatStore";

const { Text } = Typography;

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

  const [isExiting, setIsExiting] = useState(false);
  const [showHistory, setShowHistory] = useState(messages.length > 0);

  useEffect(() => {
    if (messages.length === 0) {
      setShowHistory(false);
      setIsExiting(false);
    } else if (!isExiting) {
      setShowHistory(true);
    }
  }, [messages.length, isExiting]);

  const handleSend = async (content: string) => {
    if (messages.length === 0) {
      setIsExiting(true);
      // 等待动画进行一半左右再触发请求，增强衔接感
      await new Promise((resolve) => setTimeout(resolve, 400));
      onSend(content);
      setIsExiting(false);
      setShowHistory(true);
    } else {
      onSend(content);
    }
  };

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
            <span>正在为您规划装箱方案...</span>
          </div>
        ) : message.status === "cancelled" ? (
          <Text type="secondary" className="text-xs">
            已取消本次生成
          </Text>
        ) : undefined,
      variant: "borderless",
    };
  });

  const renderSender = () => {
    const items: MenuProps["items"] = [
      {
        key: "clear",
        label: "清除历史",
        danger: true,
        icon: <DeleteOutlined />,
        onClick: handleClearHistory,
      },
    ];

    return (
      <Sender
        value={inputValue}
        onChange={setInputValue}
        onSubmit={handleSend}
        placeholder="描述您的装箱需求，例如：100个纸箱如何装进 20GP 集装箱？"
        loading={isStreaming}
        prefix={
          <Dropdown menu={{ items }} placement="topLeft">
            <Button type="text" icon={<MoreOutlined />} />
          </Dropdown>
        }
      />
    );
  };

  return (
    <div className="flex h-full flex-col bg-transparent">
      <div className="flex-1 overflow-hidden p-4 flex flex-col">
        {/* 顶部伸缩占位 - 用于将内容推向中间 */}
        <div
          className={`transition-all duration-500 ease-in-out flex flex-col items-center justify-end pb-4 ${
            !showHistory ? "flex-1" : "flex-0 h-0 opacity-0 overflow-hidden"
          }`}
        >
          <div
            className={`transition-opacity duration-400 ${
              isExiting ? "opacity-0" : "opacity-100"
            }`}
          >
            <Welcome
              variant="borderless"
              title="您好，我是您的智能装柜助手，今天有什么可以帮您？"
            />
          </div>
        </div>

        {/* 聊天记录区域 */}
        <div
          className={`mx-auto w-full max-w-4xl flex flex-col transition-all duration-500 ${
            showHistory
              ? "flex-1 min-h-0 opacity-100"
              : "h-0 opacity-0 overflow-hidden"
          }`}
        >
          {showHistory && (
            <>
              {/* {renderHeader()} */}
              <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
                <Bubble.List
                  items={bubbleItems}
                  className="h-full"
                  autoScroll
                />
              </div>
            </>
          )}
        </div>

        {/* 输入框区域 - 在中间和底部之间平滑移动 */}
        <div
          className={`mx-auto w-full max-w-4xl transition-all duration-500 ease-in-out z-20 ${
            !showHistory ? "py-2" : "pt-4 pb-2"
          }`}
        >
          {renderSender()}
        </div>

        {/* 底部伸缩占位 */}
        <div
          className={`transition-all duration-500 ease-in-out ${
            !showHistory ? "flex-1" : "flex-0 h-0"
          }`}
        />
      </div>
    </div>
  );
};

export default AgentChat;
