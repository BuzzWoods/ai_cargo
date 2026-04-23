import React from "react";
import { Button, Card, Empty, Tag, Typography, Tooltip } from "antd";
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
      <div className="flex h-full min-h-[600px] items-center justify-center bg-transparent p-6">
        <Empty
          description="这里还没有生成的方案呢，快去让 AI 帮您规划一下吧！"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          <Button type="primary" onClick={() => navigate("/chat")}>
            前往 AI 规划
          </Button>
        </Empty>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-transparent px-6 py-4">
      {/* 顶部标题与信息区 - 移除背景与边框 */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Tooltip title="返回会话">
              <Button
                type="text"
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate("/chat")}
                className="flex items-center justify-center text-slate-400 hover:text-slate-600"
                style={{ width: 32, height: 32 }}
              />
            </Tooltip>
            <Title level={3} style={{ margin: 0 }}>
              装箱三维预览
            </Title>
          </div>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            在这里，您可以 360 度全方位查看 AI 为您生成的详细装箱方案及装载建议。
          </Paragraph>
        </div>
      </div>

      {/* 主视图区域 */}
      <div className="grid flex-1 grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_280px] min-h-0">
        <div className="bg-white/40 backdrop-blur-sm rounded-3xl overflow-hidden relative h-full">
          <CargoLayoutCanvas artifact={activeArtifact} />
        </div>

        {/* 侧边摘要 - 整合标签 */}
        <div className="space-y-6 overflow-y-auto pr-2 scrollbar-hide">
          <div>
            <Title level={4} style={{ marginBottom: 16 }}>装载摘要</Title>
            <div className="flex flex-col gap-2">
              <Tag color="blue" bordered={false} className="bg-blue-50/50 w-fit">{activeArtifact.data.summary.totalItems} 件货物</Tag>
              <Tag color="cyan" bordered={false} className="bg-cyan-50/50 w-fit">
                装载率 {(activeArtifact.data.summary.fillRate * 100).toFixed(0)}%
              </Tag>
              <Tag color="gold" bordered={false} className="bg-orange-50/50 w-fit">
                容器 {activeArtifact.data.container.size.w} × {activeArtifact.data.container.size.h} × {activeArtifact.data.container.size.d} {activeArtifact.data.container.unit}
              </Tag>
            </div>
          </div>
          
          <div className="space-y-5 pt-2">
            <div>
              <Text type="secondary" className="text-xs uppercase tracking-wider font-semibold">坐标系</Text>
              <div className="mt-1 text-slate-900 font-medium">
                {activeArtifact.data.container.axis}
              </div>
            </div>

            <div>
              <Text type="secondary" className="text-xs uppercase tracking-wider font-semibold">容器原点</Text>
              <div className="mt-1 text-slate-900 font-medium">
                {activeArtifact.data.container.origin}
              </div>
            </div>

            <div>
              <Text type="secondary" className="text-xs uppercase tracking-wider font-semibold">装载建议</Text>
              <ul className="mb-0 mt-3 list-disc space-y-3 pl-4 text-slate-600 text-[14px]">
                {activeArtifact.data.summary.notes.map((note: string) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cargo3DPage;
