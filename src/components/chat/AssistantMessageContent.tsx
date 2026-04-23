import { Button, Tag, Typography } from "antd";
import type { AssistantMessage } from "../../store/useChatStore";
import MarkdownRenderer from "../markdown/MarkdownRenderer";
import CargoLayoutCanvas from "../cargo/CargoLayoutCanvas";

const { Text } = Typography;

interface AssistantMessageContentProps {
  message: AssistantMessage;
  onOpenArtifact: (artifactId: string) => void;
}

const AssistantMessageContent = ({
  message,
  onOpenArtifact,
}: AssistantMessageContentProps) => {
  const artifacts = Object.values(message.artifacts);

  return (
    <div className="min-w-[280px] max-w-full space-y-4">
      {message.markdownText ? (
        <MarkdownRenderer markdown={message.markdownText} />
      ) : (
        <Text type="secondary">
          {message.status === "error" ? "消息生成失败" : "正在准备回复内容..."}
        </Text>
      )}

      {artifacts.map((artifact) => (
        <div
          key={artifact.id}
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
            <div className="space-y-1">
              <div className="text-sm font-semibold text-slate-900">
                {artifact.title}
              </div>
              <div className="flex flex-wrap gap-2">
                <Tag color="blue">
                  {artifact.data.summary.totalItems} 件货物
                </Tag>
                <Tag color="cyan">
                  装载率 {(artifact.data.summary.fillRate * 100).toFixed(0)}%
                </Tag>
                <Tag color="gold">{artifact.data.container.unit}</Tag>
              </div>
            </div>

            <Button type="primary" onClick={() => onOpenArtifact(artifact.id)}>
              在 3D 页面查看
            </Button>
          </div>

          <div className="p-3">
            <CargoLayoutCanvas artifact={artifact} compact />
          </div>
        </div>
      ))}

      {message.error ? <Text type="danger">{message.error}</Text> : null}
    </div>
  );
};

export default AssistantMessageContent;
