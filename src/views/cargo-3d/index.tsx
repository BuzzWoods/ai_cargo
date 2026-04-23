import React, { useEffect, useState } from "react";
import { Button, Collapse, Empty, Tag, Typography, Tooltip } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import CargoLayoutCanvas from "../../components/cargo/CargoLayoutCanvas";
import CargoInfoCard from "../../components/cargo/CargoInfoCard";
import { useChatStore } from "../../store/useChatStore";

const { Paragraph, Text, Title } = Typography;

const Cargo3DPage: React.FC = () => {
  const navigate = useNavigate();
  const { messages, activeArtifactId } = useChatStore();
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(
    null,
  );

  const artifacts = messages
    .filter((message) => message.role === "assistant")
    .flatMap((message) => Object.values(message.artifacts));

  const activeArtifact =
    artifacts.find((artifact) => artifact.id === activeArtifactId) ??
    (artifacts.length ? artifacts[artifacts.length - 1] : null) ??
    null;
  const cargoInfoById = new Map(
    activeArtifact?.data.cargoBasicInfos.map((item) => [item.id, item]) ?? [],
  );

  useEffect(() => {
    setSelectedPlacementId(activeArtifact?.data.placements[0]?.id ?? null);
  }, [activeArtifact?.id]);

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
            在这里，您可以 360 度全方位查看 AI
            为您生成的详细装箱方案及装载建议。
          </Paragraph>
        </div>
      </div>

      {/* 主视图区域 */}
      <div className="grid flex-1 min-h-0 grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="h-full overflow-hidden rounded-3xl bg-white/40 backdrop-blur-sm">
          <CargoLayoutCanvas
            artifact={activeArtifact}
            interactive
            selectedPlacementId={selectedPlacementId}
            onPlacementSelect={(placement) => {
              setSelectedPlacementId(placement.id);
            }}
          />
        </div>

        <div className="min-h-0 overflow-y-auto rounded-3xl border border-slate-200/70 bg-white/80 p-4 shadow-sm backdrop-blur-sm scrollbar-hide">
          <div className="space-y-5">
            <CargoInfoCard
              artifact={activeArtifact}
              selectedPlacementId={selectedPlacementId}
            />

            <Collapse
              bordered={false}
              defaultActiveKey={[]}
              className="rounded-2xl bg-slate-50/70"
              items={[
                {
                  key: "summary",
                  label: (
                    <div className="flex items-center justify-between gap-3">
                      <Title level={4} style={{ margin: 0 }}>
                        装载摘要
                      </Title>
                    </div>
                  ),
                  children: (
                    <div className="space-y-4 pt-1">
                      <div className="flex flex-col gap-2">
                        <Tag
                          color="blue"
                          variant="filled"
                          className="bg-blue-50/50 w-fit"
                        >
                          {activeArtifact.data.summary.totalItems} 件货物
                        </Tag>
                        <Tag
                          color="cyan"
                          variant="filled"
                          className="bg-cyan-50/50 w-fit"
                        >
                          装载率{" "}
                          {(activeArtifact.data.summary.fillRate * 100).toFixed(
                            0,
                          )}
                          %
                        </Tag>
                        <Tag
                          color="gold"
                          variant="filled"
                          className="bg-orange-50/50 w-fit"
                        >
                          容器 {activeArtifact.data.container.size.w} ×{" "}
                          {activeArtifact.data.container.size.h} ×{" "}
                          {activeArtifact.data.container.size.d}{" "}
                          {activeArtifact.data.container.unit}
                        </Tag>
                      </div>

                      <div>
                        <Text
                          type="secondary"
                          className="text-xs uppercase tracking-wider font-semibold"
                        >
                          装载建议
                        </Text>
                        <ul className="mb-0 mt-3 list-disc space-y-3 pl-4 text-[14px] text-slate-600">
                          {activeArtifact.data.summary.notes.map(
                            (note: string) => (
                              <li key={note}>{note}</li>
                            ),
                          )}
                        </ul>
                      </div>
                    </div>
                  ),
                },
              ]}
            />
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-slate-200/70 bg-white/80 p-4 shadow-sm backdrop-blur-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <Title level={4} style={{ margin: 0 }}>
            快速切换
          </Title>
          <Text type="secondary" className="text-xs">
            选择不同货物查看卡片与 3D 选中状态
          </Text>
        </div>
        <div className="flex flex-wrap gap-2">
          {activeArtifact.data.placements.map((placement) => {
            const cargo = cargoInfoById.get(placement.cargoId);

            return (
              <button
                key={placement.id}
                type="button"
                onClick={() => setSelectedPlacementId(placement.id)}
                className={`rounded-full border px-3 py-1 text-sm transition ${
                  placement.id === selectedPlacementId
                    ? "border-sky-400 bg-sky-50 text-sky-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:text-sky-600"
                }`}
              >
                {cargo?.sku ?? cargo?.name ?? placement.cargoId}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Cargo3DPage;
