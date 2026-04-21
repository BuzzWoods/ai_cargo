import React, { useState } from "react";
import {
  Bubble,
  Sender,
  Welcome,
  Prompts,
  type BubbleProps,
} from "@ant-design/x";
import { Typography, Button, Avatar } from "antd";
import { DeleteOutlined, UserOutlined, RobotOutlined } from "@ant-design/icons";
import { useChatStore } from "../../store/useChatStore";
import { simulateChatStream } from "../../api/request";

const { Title } = Typography;

const AgentChat: React.FC = () => {
  const { messages, addMessage, updateMessage, clearHistory } = useChatStore();
  const [inputValue, setInputValue] = useState("");

  const onSend = (content: string) => {
    if (!content.trim()) return;

    // Add user message
    addMessage({ role: "user", content, status: "done" });
    setInputValue("");

    // Simulate AI response with streaming
    const aiId = addMessage({
      role: "assistant",
      content: "",
      status: "loading",
    });

    simulateChatStream(content, (text, done) => {
      updateMessage(aiId, {
        content: text,
        status: done ? "done" : "loading",
      });
    });
  };

  const bubbleItems = messages.map((msg) => ({
    key: msg.id,
    content: msg.content,
    role: msg.role,
    placement: (msg.role === "user"
      ? "end"
      : "start") as BubbleProps["placement"],
    avatar: (
      <Avatar
        icon={msg.role === "user" ? <UserOutlined /> : <RobotOutlined />}
        style={{ backgroundColor: msg.role === "user" ? "#1677ff" : "#52c41a" }}
      />
    ),
    loading: msg.status === "loading",
  }));

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center">
        <div className="w-full max-w-4xl h-full flex flex-col">
          {messages.length === 0 ? (
            <Welcome
              variant="borderless"
              icon={
                <RobotOutlined style={{ fontSize: 64, color: "#1677ff" }} />
              }
              title="你好，我是你的专属 AI 助手"
              description="我基于 Ant Design X 构建，拥有流畅的交互体验和极速的响应能力。"
              extra={
                <Prompts
                  items={[
                    { key: "1", label: "如何集成 Ant Design X？" },
                    { key: "2", label: "介绍一下这个项目的技术栈" },
                    { key: "3", label: "帮我写一段 TypeScript 代码" },
                  ]}
                  onItemClick={(item) => onSend(item.data.label as string)}
                />
              }
            />
          ) : (
            <>
              <div className="flex justify-between items-center mb-4 px-2">
                <Title level={4} style={{ margin: 0 }}>
                  会话详情
                </Title>
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={clearHistory}
                >
                  清除历史
                </Button>
              </div>
              <Bubble.List items={bubbleItems} className="flex-1" autoScroll />
            </>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-slate-200">
        <div className="max-w-4xl mx-auto relative">
          <Sender
            value={inputValue}
            onChange={setInputValue}
            onSubmit={onSend}
            placeholder="输入您的问题..."
            loading={messages.some((m) => m.status === "loading")}
          />
        </div>
      </div>
    </div>
  );
};

export default AgentChat;
