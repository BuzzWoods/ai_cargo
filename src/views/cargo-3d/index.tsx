import React from "react";
import { Button, Card, Empty, Tag, Typography } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import CargoLayoutCanvas from "../../components/cargo/CargoLayoutCanvas";
import { useChatStore } from "../../store/useChatStore";

const { Paragraph, Text, Title } = Typography;

const Cargo3DPage: React.FC = () => {
  const navigate = useNavigate();
  const { messages, activeArtifactId } = useChatStore();

  const artifacts = messages
    .filter((message) => message.role === "assistant")
    .flatMap((message) => Object.values(message.artifacts));

  const activeArtifact =
    artifacts.find((artifact) => artifact.id === activeArtifactId) ??
    (artifacts.length ? artifacts[artifacts.length - 1] : null) ??
    null;

  if (!activeArtifact) {
    return (
      <div className="flex h-full min-h-[600px] items-center justify-center bg-slate-50 p-6">
        <Empty
          description="暂无 3D 结构数据，请先去 AI Chat 发起一条装箱请求。"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          <Button type="primary" onClick={() => navigate("/chat")}>
            前往 AI Chat
          </Button>
        </Empty>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[600px] flex-col bg-slate-50">
      <div className="relative z-10 border-b border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <Button
              type="link"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate("/chat")}
              style={{ paddingInline: 0 }}
            >
              返回会话
            </Button>
            <Title level={3} style={{ margin: 0 }}>
              {activeArtifact.title}
            </Title>
            <Paragraph type="secondary" style={{ margin: 0 }}>
              当前页面直接消费聊天流里落下来的 `cargo_layout` artifact，
              这里看到的就是 assistant 消息对应的最终结构化结果。
            </Paragraph>
          </div>

          <div className="flex flex-wrap gap-2">
            <Tag color="blue">{activeArtifact.data.summary.totalItems} 件货物</Tag>
            <Tag color="cyan">
              装载率 {(activeArtifact.data.summary.fillRate * 100).toFixed(0)}%
            </Tag>
            <Tag color="gold">
              容器 {activeArtifact.data.container.size.w} ×{" "}
              {activeArtifact.data.container.size.h} ×{" "}
              {activeArtifact.data.container.size.d}{" "}
              {activeArtifact.data.container.unit}
            </Tag>
          </div>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <CargoLayoutCanvas artifact={activeArtifact} />

        <Card title="装载摘要" className="overflow-hidden">
          <div className="space-y-4">
            <div>
              <Text type="secondary">坐标系</Text>
              <div className="mt-1 font-medium text-slate-900">
                {activeArtifact.data.container.axis}
              </div>
            </div>

            <div>
              <Text type="secondary">容器原点</Text>
              <div className="mt-1 font-medium text-slate-900">
                {activeArtifact.data.container.origin}
              </div>
            </div>

            <div>
              <Text type="secondary">装载建议</Text>
              <ul className="mb-0 mt-2 list-disc space-y-2 pl-5 text-slate-700">
                {activeArtifact.data.summary.notes.map((note: string) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Cargo3DPage;
