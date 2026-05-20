import { Button, Select, Tag, Typography } from "antd";
import type { AssistantContentBlock } from "../../api/protocol";
import type { AssistantMessage } from "../../store/useChatStore";
import MarkdownRenderer from "../markdown/MarkdownRenderer";
import CargoLayoutCanvas from "../cargo/CargoLayoutCanvas";
import {
  createCargoPackingSceneView,
  formatPercent,
  getContainerByNo,
  getPlanByNo,
  getPreferredPlan,
} from "../cargo/cargoPackingView";
import { Loader2 } from "lucide-react";

const { Text } = Typography;

export interface CargoPreviewSelection {
  planNo: string | null;
  containerNo: string | null;
}

interface AssistantMessageContentProps {
  message: AssistantMessage;
  onOpenArtifact: (artifactId: string) => void;
  previewSelections?: Record<string, CargoPreviewSelection | undefined>;
  onPreviewSelectionChange?: (
    artifactId: string,
    selection: CargoPreviewSelection,
  ) => void;
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
  const contentLines = lines.filter((line) => !isStreamingProgressLine(line));

  return contentLines.length ? contentLines.join("\n") : markdownText;
};

const isProgressBlock = (
  block: AssistantContentBlock,
): block is Extract<AssistantContentBlock, { type: "progress" }> =>
  block.type === "progress";

const renderProgressBlock = (
  block: Extract<AssistantContentBlock, { type: "progress" }>,
) => (
  <div
    key={block.id}
    className="inline-flex max-w-full items-center gap-2 rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2 text-sm text-slate-500"
  >
    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" />
    <span className="min-w-0 break-words">{block.text}</span>
  </div>
);

const AssistantMessageContent = ({
  message,
  onOpenArtifact,
  previewSelections,
  onPreviewSelectionChange,
}: AssistantMessageContentProps) => {
  const renderArtifactPreview = (artifactId: string, key: string) => {
    const artifact = message.artifacts[artifactId];

    if (!artifact) {
      return null;
    }

    // 聊天页只做小预览：默认取推荐计划，没有推荐则取第一个计划/箱子。
    const previewSelection = previewSelections?.[artifact.id];
    const plan =
      getPlanByNo(artifact, previewSelection?.planNo ?? null) ??
      getPreferredPlan(artifact);
    const container = getContainerByNo(
      plan,
      previewSelection?.containerNo ?? null,
    );
    const layoutView = createCargoPackingSceneView(artifact, plan, container);

    if (!plan || !container || !layoutView) {
      return null;
    }

    return (
      <div
        key={key}
        className="overflow-hidden border rounded-2xl border-slate-200/60 bg-white/50 backdrop-blur-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-200/60 bg-slate-100/30">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-slate-900">
              {artifact.title}
            </div>
            <div className="flex flex-wrap gap-2">
              <Select
                size="small"
                aria-label="切换装箱计划"
                value={plan.planNo}
                className="min-w-[160px]"
                options={artifact.data.plans.map((item) => ({
                  label: `${item.planNo}${item.recommended ? " 推荐" : ""}`,
                  value: item.planNo,
                }))}
                onChange={(value) => {
                  const nextPlan = artifact.data.plans.find(
                    (item) => item.planNo === value,
                  );

                  onPreviewSelectionChange?.(artifact.id, {
                    planNo: value,
                    containerNo: nextPlan?.containers[0]?.containerNo ?? null,
                  });
                }}
              />
              <Select
                size="small"
                aria-label="切换货柜"
                value={container.containerNo}
                className="min-w-[180px]"
                options={plan.containers.map((item) => ({
                  label: `${item.containerNo} ${item.containerType}`,
                  value: item.containerNo,
                }))}
                onChange={(value) =>
                  onPreviewSelectionChange?.(artifact.id, {
                    planNo: plan.planNo,
                    containerNo: value,
                  })
                }
              />
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
            selectedContainerNo={container.containerNo}
          />
        </div>
      </div>
    );
  };

  const contentBlocks: AssistantContentBlock[] = message.contentBlocks?.length
    ? message.contentBlocks
    : [
        ...(message.markdownText
          ? [
              {
                id: `${message.id}:markdown:fallback`,
                type: "markdown" as const,
                startSeq: 0,
                endSeq: 0,
                text: message.markdownText,
              },
            ]
          : []),
        ...Object.keys(message.artifacts).map((artifactId, index) => ({
          id: `${message.id}:artifact:${artifactId}`,
          type: "artifact" as const,
          seq: index + 1,
          artifactId,
        })),
      ];

  // contentBlocks 记录 SSE 到达顺序，因此 3D 卡片不再固定显示在整段 Markdown 后面。
  const hasFormalContent = contentBlocks.some(
    (block) => !isProgressBlock(block),
  );
  const visibleProgressBlock = hasFormalContent
    ? null
    : ([...contentBlocks].reverse().find(isProgressBlock) ?? null);
  const contentNodes = contentBlocks
    .map((block) => {
      if (isProgressBlock(block)) {
        return null;
      }

      if (block.type === "markdown") {
        const visibleMarkdown = getVisibleAssistantMarkdown(block.text);

        return visibleMarkdown ? (
          <MarkdownRenderer key={block.id} markdown={visibleMarkdown} />
        ) : null;
      }

      return renderArtifactPreview(block.artifactId, block.id);
    })
    .filter(Boolean);
  const hasVisibleContent =
    Boolean(visibleProgressBlock) || contentNodes.length > 0;

  return (
    <div className="min-w-[280px] max-w-full space-y-4">
      {visibleProgressBlock ? renderProgressBlock(visibleProgressBlock) : null}
      {hasVisibleContent ? (
        contentNodes
      ) : (
        <Text type="secondary">
          {message.status === "error"
            ? "方案生成遇到了一点问题"
            : "正在为您规划装箱方案，请稍候..."}
        </Text>
      )}

      {message.status === "error" && message.error ? (
        <Text type="danger" className="chat-error-text">
          {message.error}
        </Text>
      ) : null}
    </div>
  );
};

export default AssistantMessageContent;
