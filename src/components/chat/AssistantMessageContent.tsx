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
          {message.status === "error" ? "方案生成遇到了一点问题" : "正在为您规划装箱方案，请稍候..."}
        </Text>
      )}

      {artifacts.map((artifact) => {
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
