import { Button, Tag, Typography } from "antd";
import type { AssistantMessage } from "../../store/useChatStore";
import MarkdownRenderer from "../markdown/MarkdownRenderer";
import CargoLayoutCanvas from "../cargo/CargoLayoutCanvas";
import {
  createCargoLayoutView,
  formatPercent,
  getContainerByNo,
  getPreferredPlan,
} from "../cargo/cargoPackingView";

const { Text } = Typography;

interface AssistantMessageContentProps {
  message: AssistantMessage;
  onOpenArtifact: (artifactId: string) => void;
}

const streamingProgressTexts = [
  "正在读取业务数据...",
  "正在解析业务诉求...",
  "正在计算排柜方案...",
  "正在生成方案说明...",
];

const normalizeLine = (line: string) => line.trim().replace(/\s+/g, "");

const isStreamingProgressLine = (line: string) => {
  const normalizedLine = normalizeLine(line);

  return streamingProgressTexts.some(
    (progressText) => normalizedLine === normalizeLine(progressText),
  );
};

export const getVisibleAssistantMarkdown = (markdownText: string) => {
  const lines = markdownText.split(/\r?\n/);
  const contentLines = lines.filter((line) => {
    if (!line.trim()) {
      return false;
    }

    return !isStreamingProgressLine(line);
  });

  return contentLines.length ? contentLines.join("\n") : markdownText;
};

const AssistantMessageContent = ({
  message,
  onOpenArtifact,
}: AssistantMessageContentProps) => {
  // 一个 assistant 气泡可以同时包含 markdown 文本和一个或多个 3D artifact。
  const artifacts = Object.values(message.artifacts);
  const visibleMarkdown = getVisibleAssistantMarkdown(message.markdownText);

  return (
    <div className="min-w-[280px] max-w-full space-y-4">
      {visibleMarkdown ? (
        <MarkdownRenderer markdown={visibleMarkdown} />
      ) : (
        <Text type="secondary">
          {message.status === "error" ? "方案生成遇到了一点问题" : "正在为您规划装箱方案，请稍候..."}
        </Text>
      )}

      {artifacts.map((artifact) => {
        // 聊天页只做小预览：默认取推荐计划，没有推荐则取第一个计划/箱子。
        const plan = getPreferredPlan(artifact);
        const container = getContainerByNo(plan, null);
        const layoutView = createCargoLayoutView(artifact, plan, container);

        if (!plan || !container || !layoutView) {
          return null;
        }

        return (
          <div
            key={artifact.id}
            className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white/50 backdrop-blur-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/60 bg-slate-100/30 px-4 py-3">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-slate-900">
                  {artifact.title}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Tag color="blue" variant="filled">
                    {plan.planNo}
                    {plan.recommended ? " 推荐" : ""}
                  </Tag>
                  <Tag color="cyan" variant="filled">
                    {container.containerNo} / {container.containerType}
                  </Tag>
                  <Tag color="green" variant="filled">
                    体积 {formatPercent(container.volumeUtilization)}
                  </Tag>
                  <Tag color="gold" variant="filled">
                    {container.items.length} 件
                  </Tag>
                </div>
              </div>

              <Button type="primary" onClick={() => onOpenArtifact(artifact.id)}>
                在 3D 页面查看
              </Button>
            </div>

            <div className="p-3">
              <CargoLayoutCanvas
                artifact={layoutView}
                compact
                interactive={false}
              />
            </div>
          </div>
        );
      })}

      {message.error ? <Text type="danger">{message.error}</Text> : null}
    </div>
  );
};

export default AssistantMessageContent;
