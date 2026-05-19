import React, { useEffect, useRef, useState } from "react";
import { Bubble, Sender, Welcome, type BubbleItemType } from "@ant-design/x";
import { App as AntdApp, Typography, Button } from "antd";
import {
  ArrowDownOutlined,
  CheckOutlined,
  CopyOutlined,
  LoadingOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { sendChatMessage } from "../../api/chat";
import AssistantMessageContent, {
  getVisibleAssistantMarkdown,
  type CargoPreviewSelection,
} from "../../components/chat/AssistantMessageContent";
import ShipmentBatchSelectorModal from "../../components/chat/ShipmentBatchSelectorModal";
import type { AssistantMessage } from "../../store/useChatStore";
import { useChatStore } from "../../store/useChatStore";

const { Text } = Typography;

const copyTextToClipboard = async (text: string) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
};

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
  const { message: antdMessage } = AntdApp.useApp();
  // 当前只允许一个流式请求在跑；切换会话/卸载时会 abort 这条请求。
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeConversationRef = useRef<string | null>(null);
  const copyResetTimerRef = useRef<number | null>(null);
  const historyScrollRef = useRef<HTMLDivElement | null>(null);
  const programmaticScrollFrameRef = useRef<number | null>(null);
  const programmaticScrollRef = useRef(false);
  const stickToBottomRef = useRef(true);
  const [inputValue, setInputValue] = useState("");
  const [batchSelectorOpen, setBatchSelectorOpen] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [previewSelections, setPreviewSelections] = useState<
    Record<string, CargoPreviewSelection>
  >({});
  const [isStartingNewConversation, setIsStartingNewConversation] =
    useState(false);
  const {
    serverConversationId,
    activeLocalConversationId,
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
    createNewConversation,
  } = useChatStore();

  const [isExiting, setIsExiting] = useState(false);
  const [showHistory, setShowHistory] = useState(messages.length > 0);

  // 欢迎页和聊天记录是同一屏里的两个状态，通过 showHistory 做过渡切换。
  useEffect(() => {
    if (messages.length === 0) {
      setShowHistory(false);
      setIsExiting(false);
    } else if (!isExiting) {
      setShowHistory(true);
    }
  }, [messages.length, isExiting]);

  const handleSend = async (content: string) => {
    if (isStartingNewConversation) {
      return;
    }

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

  const resetConversationUiState = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    stickToBottomRef.current = true;
    setShowScrollToBottom(false);
    setPreviewSelections({});
    setInputValue("");
    setCopiedMessageId(null);
  };

  const isNearScrollBottom = (element: HTMLDivElement) =>
    element.scrollHeight - element.scrollTop - element.clientHeight < 120;

  const stopProgrammaticScrollMonitor = () => {
    if (programmaticScrollFrameRef.current) {
      window.cancelAnimationFrame(programmaticScrollFrameRef.current);
      programmaticScrollFrameRef.current = null;
    }
  };

  const monitorProgrammaticScroll = (startedAt: number) => {
    const element = historyScrollRef.current;

    if (!element) {
      programmaticScrollRef.current = false;
      stopProgrammaticScrollMonitor();
      return;
    }

    const nearBottom = isNearScrollBottom(element);
    const timedOut = performance.now() - startedAt > 1800;

    if (nearBottom || timedOut) {
      programmaticScrollRef.current = false;
      stopProgrammaticScrollMonitor();
      setShowScrollToBottom(!nearBottom);
      return;
    }

    setShowScrollToBottom(false);
    programmaticScrollFrameRef.current = window.requestAnimationFrame(() =>
      monitorProgrammaticScroll(startedAt),
    );
  };

  const scrollHistoryToBottom = (behavior: ScrollBehavior = "smooth") => {
    const element = historyScrollRef.current;

    if (!element) {
      return;
    }

    programmaticScrollRef.current = behavior === "smooth";
    stopProgrammaticScrollMonitor();

    element.scrollTo({
      top: element.scrollHeight,
      behavior,
    });
    stickToBottomRef.current = true;
    setShowScrollToBottom(false);

    if (behavior === "smooth") {
      programmaticScrollFrameRef.current = window.requestAnimationFrame(() =>
        monitorProgrammaticScroll(performance.now()),
      );
    } else {
      programmaticScrollRef.current = false;
    }
  };

  const handleHistoryScroll = () => {
    const element = historyScrollRef.current;

    if (!element) {
      return;
    }

    const nearBottom = isNearScrollBottom(element);
    if (programmaticScrollRef.current) {
      if (nearBottom) {
        programmaticScrollRef.current = false;
      }
      return;
    }

    stickToBottomRef.current = nearBottom;
    setShowScrollToBottom(!nearBottom);
  };

  useEffect(() => {
    if (!showHistory || !stickToBottomRef.current) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      scrollHistoryToBottom("auto");
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [messages, showHistory]);

  useEffect(() => {
    if (activeConversationRef.current === null) {
      activeConversationRef.current = activeLocalConversationId;
      return;
    }

    if (activeConversationRef.current !== activeLocalConversationId) {
      resetConversationUiState();
      activeConversationRef.current = activeLocalConversationId;
    }
  }, [activeLocalConversationId]);

  useEffect(() => {
    // 组件卸载时关闭 SSE，防止后台连接继续写入已卸载的页面。
    return () => {
      abortControllerRef.current?.abort();
      if (copyResetTimerRef.current) {
        window.clearTimeout(copyResetTimerRef.current);
      }
      stopProgrammaticScrollMonitor();
    };
  }, []);

  const handleOpenArtifact = (artifactId: string) => {
    setActiveArtifactId(artifactId);
    navigate("/cargo-3d");
  };

  const handlePreviewSelectionChange = (
    artifactId: string,
    selection: CargoPreviewSelection,
  ) => {
    setPreviewSelections((current) => ({
      ...current,
      [artifactId]: selection,
    }));
  };

  const handleStartNewConversation = () => {
    if (isStartingNewConversation) {
      return;
    }

    resetConversationUiState();
    setIsStartingNewConversation(true);

    const localConversationId = createNewConversation();
    navigate(`/chat?conversationId=${encodeURIComponent(localConversationId)}`);
    antdMessage.success("已开启新对话");
    window.setTimeout(() => {
      setIsStartingNewConversation(false);
    }, 120);
  };

  const handleAppendShipmentBatchNos = (batchPlanNos: string[]) => {
    if (!batchPlanNos.length) {
      return;
    }

    const appendedText = `出货批次编号：${batchPlanNos.join("、")}`;

    setInputValue((current) =>
      current.trim()
        ? `${current.trimEnd()}\n${appendedText}`
        : appendedText,
    );
    setBatchSelectorOpen(false);
  };

  const handleCopyMessage = async (messageId: string, text: string) => {
    const copyText = text.trim();

    if (!copyText) {
      return;
    }

    await copyTextToClipboard(copyText);
    setCopiedMessageId(messageId);

    if (copyResetTimerRef.current) {
      window.clearTimeout(copyResetTimerRef.current);
    }

    copyResetTimerRef.current = window.setTimeout(() => {
      setCopiedMessageId(null);
    }, 3000);
  };

  const renderCopyButton = ({
    messageId,
    text,
  }: {
    messageId: string;
    text: string;
  }) => {
    const canCopy = text.trim().length > 0;

    if (!canCopy) {
      return null;
    }

    const copied = copiedMessageId === messageId;

    return (
      <Button
        type="text"
        size="small"
        icon={
          copied ? (
            <CheckOutlined className="text-emerald-500" />
          ) : (
            <CopyOutlined />
          )
        }
        className={`transition-opacity ${
          copied
            ? "opacity-100"
            : "opacity-0 group-hover/chat-message:opacity-100 focus:opacity-100"
        }`}
        onClick={() => handleCopyMessage(messageId, text)}
        aria-label={copied ? "已复制" : "复制文本"}
      />
    );
  };

  const renderMessageFooter = ({
    messageId,
    placement,
    status,
    text,
  }: {
    messageId: string;
    placement: "start" | "end";
    status?: React.ReactNode;
    text: string;
  }) => {
    const copyButton = renderCopyButton({ messageId, text });

    if (!status && !copyButton) {
      return undefined;
    }

    return (
      <div
        className={`flex w-full items-center gap-2 ${
          placement === "end" ? "justify-end" : "justify-start"
        }`}
      >
        {status}
        {copyButton}
      </div>
    );
  };

  const onSend = async (content: string) => {
    const trimmedContent = content.trim();
    if (!trimmedContent || isStreaming || isStartingNewConversation) {
      return;
    }

    // 一次发送会产生两个本地节点：用户气泡 + 等待 SSE 填充的 assistant 占位气泡。
    const { localId: localUserMessageId, clientMessageId } =
      addUserMessage(trimmedContent);
    const localAssistantMessageId = addAssistantPlaceholder();
    const localConversationIdAtSend =
      useChatStore.getState().activeLocalConversationId;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    stickToBottomRef.current = true;
    setShowScrollToBottom(false);
    setInputValue("");
    let currentServerRequestId: string | undefined;
    let currentServerMessageId: string | undefined;
    const isCurrentConversationActive = () =>
      useChatStore.getState().activeLocalConversationId ===
      localConversationIdAtSend;
    // accepted/start/delta 都可能携带服务端 id；这里统一把本地气泡和服务端消息绑定起来。
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
          if (!isCurrentConversationActive()) {
            return;
          }

          // HTTP accepted 只说明任务进入后端队列，UI 先进入 accepted 状态等待 SSE。
          currentServerRequestId = response.requestId;
          bindServerConversationId(response.conversationId);
          navigate(`/chat?conversationId=${encodeURIComponent(response.conversationId)}`, {
            replace: true,
          });
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
          if (!isCurrentConversationActive()) {
            return;
          }

          // 防御：如果旧请求/重连事件混进来，不写入当前 assistant 气泡。
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
            // 文本是 markdown 增量，页面边收边渲染。
            appendAssistantMarkdown(
              localAssistantMessageId,
              event.payload.delta,
              event.seq,
            );
            return;
          }

          if (event.type === "artifact.replace") {
            // 3D 数据是结构化 artifact；这里不改 inner data，只存入 store 交给 3D 组件解析。
            if (!event.payload.artifact) {
              return;
            }

            replaceAssistantArtifact(
              localAssistantMessageId,
              event.payload.artifact,
              event.seq,
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
        className: "group/chat-message",
        content: (
          <div className="whitespace-pre-wrap text-[15px] leading-7">
            {message.text}
          </div>
        ),
        footer: renderMessageFooter({
          messageId: message.id,
          placement: "end",
          text: message.text,
        }),
        role: message.role,
        placement: "end",
        variant: "filled",
      };
    }

    const assistantMessage = message as AssistantMessage;
    const hasArtifact = Object.keys(assistantMessage.artifacts).length > 0;
    const assistantCopyText = [
      getVisibleAssistantMarkdown(assistantMessage.markdownText),
      assistantMessage.error ? `错误：${assistantMessage.error}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    return {
      key: message.id,
      className: "group/chat-message",
      content: (
        <AssistantMessageContent
          message={assistantMessage}
          onOpenArtifact={handleOpenArtifact}
          previewSelections={previewSelections}
          onPreviewSelectionChange={handlePreviewSelectionChange}
        />
      ),
      footer: renderMessageFooter({
        messageId: message.id,
        placement: "start",
        text: assistantCopyText,
        status:
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
      }),
      role: message.role,
      placement: "start",
      loading:
        !message.markdownText &&
        !hasArtifact &&
        (message.status === "pending" ||
          message.status === "accepted" ||
          message.status === "streaming"),
      variant: "borderless",
    };
  });

  const renderSender = () => {
    return (
      <Sender
        value={inputValue}
        onChange={setInputValue}
        onSubmit={handleSend}
        placeholder="描述您的装箱需求，例如：100个纸箱如何装进 20GP 集装箱？"
        prefix={
          <div className="flex items-center gap-1">
            <Button
              type="text"
              size="small"
              icon={<PlusOutlined />}
              loading={isStartingNewConversation}
              onClick={handleStartNewConversation}
            >
              开启新对话
            </Button>
          </div>
        }
        disabled={isStartingNewConversation}
        loading={isStreaming || isStartingNewConversation}
      />
    );
  };

  return (
    <div className="flex h-full flex-col bg-transparent">
      <div className="relative flex flex-1 flex-col overflow-hidden p-4">
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
          className={`w-full flex flex-col transition-all duration-500 ${
            showHistory
              ? "flex-1 min-h-0 opacity-100"
              : "h-0 opacity-0 overflow-hidden"
          }`}
        >
          {showHistory && (
            <>
              {/* {renderHeader()} */}
              <div
                ref={historyScrollRef}
                className="-mx-4 min-h-0 flex-1 overflow-y-auto px-4 scrollbar-hide"
                onScroll={handleHistoryScroll}
              >
                <div className="mx-auto min-h-full w-full max-w-4xl py-2">
                  <Bubble.List items={bubbleItems} />
                </div>
              </div>
            </>
          )}
        </div>

        {showHistory && showScrollToBottom ? (
          <div className="pointer-events-none absolute inset-x-4 bottom-24 z-30 flex justify-center">
            <div className="flex w-full max-w-4xl justify-end">
              <Button
                type="primary"
                shape="circle"
                icon={<ArrowDownOutlined />}
                className="pointer-events-auto shadow-lg"
                aria-label="回到底部"
                onClick={() => scrollHistoryToBottom()}
              />
            </div>
          </div>
        ) : null}

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
      <ShipmentBatchSelectorModal
        open={batchSelectorOpen}
        onCancel={() => setBatchSelectorOpen(false)}
        onConfirm={handleAppendShipmentBatchNos}
      />
    </div>
  );
};

export default AgentChat;
