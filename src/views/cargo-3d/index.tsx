import React, { useEffect, useMemo, useState } from "react";
import { Button, Collapse, Empty, Segmented, Tag, Typography, Tooltip } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import CargoLayoutCanvas from "../../components/cargo/CargoLayoutCanvas";
import CargoInfoCard from "../../components/cargo/CargoInfoCard";
import {
  createCargoLayoutView,
  formatPercent,
  getContainerByNo,
  getPlanByNo,
  getPreferredPlan,
} from "../../components/cargo/cargoPackingView";
import { useChatStore } from "../../store/useChatStore";

const { Paragraph, Text, Title } = Typography;

const riskColorByLevel: Record<string, string> = {
  high: "red",
  medium: "orange",
  low: "blue",
  warning: "orange",
  error: "red",
};

const Cargo3DPage: React.FC = () => {
  const navigate = useNavigate();
  const { messages, activeArtifactId } = useChatStore();
  const [selectedPlanNo, setSelectedPlanNo] = useState<string | null>(null);
  const [selectedContainerNo, setSelectedContainerNo] = useState<string | null>(
    null,
  );
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
  const preferredPlan = activeArtifact ? getPreferredPlan(activeArtifact) : null;
  const preferredPlanNo = preferredPlan?.planNo ?? null;
  const preferredContainerNo = preferredPlan?.containers[0]?.containerNo ?? null;
  const selectedPlan = activeArtifact
    ? getPlanByNo(activeArtifact, selectedPlanNo)
    : null;
  const selectedContainer = getContainerByNo(selectedPlan, selectedContainerNo);

  const baseLayoutView = useMemo(
    () => createCargoLayoutView(activeArtifact, selectedPlan, selectedContainer),
    [activeArtifact, selectedPlan, selectedContainer],
  );
  const layoutView = useMemo(
    () => createCargoLayoutView(activeArtifact, selectedPlan, selectedContainer),
    [activeArtifact, selectedContainer, selectedPlan],
  );
  const baseLayoutViewId = baseLayoutView?.id ?? null;
  const baseFirstPlacementId = baseLayoutView?.placements[0]?.id ?? null;

  useEffect(() => {
    setSelectedPlanNo(preferredPlanNo);
    setSelectedContainerNo(preferredContainerNo);
  }, [activeArtifact?.id, preferredContainerNo, preferredPlanNo]);

  useEffect(() => {
    if (!selectedPlan) {
      setSelectedContainerNo(null);
      return;
    }

    const currentContainer = getContainerByNo(selectedPlan, selectedContainerNo);
    setSelectedContainerNo(currentContainer?.containerNo ?? null);
  }, [selectedContainerNo, selectedPlan]);

  useEffect(() => {
    setSelectedPlacementId(baseFirstPlacementId);
  }, [baseFirstPlacementId, baseLayoutViewId]);

  if (!activeArtifact || !layoutView || !selectedPlan || !selectedContainer) {
    return (
      <div className="flex h-full min-h-[600px] items-center justify-center bg-transparent p-6">
        <Empty
          description="这里还没有生成的多箱装箱计划，快去让 AI 帮您规划一下吧。"
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
      <div className="mb-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
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
              当前展示 {selectedPlan.planNo} / {selectedContainer.containerNo}
            </Paragraph>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Tag color="blue" variant="filled" className="m-0">
              {selectedPlan.recommended ? "推荐计划" : selectedPlan.strategyCode}
            </Tag>
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-2">
            <Text type="secondary" className="text-xs font-semibold">
              装箱计划
            </Text>
            <Segmented
              value={selectedPlan.planNo}
              className="w-fit max-w-full"
              options={activeArtifact.data.plans.map((plan) => ({
                label: `${plan.planNo}${plan.recommended ? " 推荐" : ""}`,
                value: plan.planNo,
              }))}
              onChange={(value) => {
                const nextPlan = activeArtifact.data.plans.find(
                  (plan) => plan.planNo === String(value),
                );
                setSelectedPlanNo(String(value));
                setSelectedContainerNo(nextPlan?.containers[0]?.containerNo ?? null);
              }}
            />
          </div>

          <div className="space-y-2">
            <Text type="secondary" className="text-xs font-semibold">
              箱子
            </Text>
            <Segmented
              value={selectedContainer.containerNo}
              className="w-fit max-w-full"
              options={selectedPlan.containers.map((container) => ({
                label: `${container.containerNo} ${container.containerType}`,
                value: container.containerNo,
              }))}
              onChange={(value) => setSelectedContainerNo(String(value))}
            />
          </div>
        </div>
      </div>

      <div className="grid flex-1 min-h-0 grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="h-full overflow-hidden rounded-3xl bg-white/40 backdrop-blur-sm">
          <CargoLayoutCanvas
            artifact={layoutView}
            interactive
            selectedPlacementId={selectedPlacementId}
            onPlacementSelect={(placement) => setSelectedPlacementId(placement.id)}
          />
        </div>

        <div className="min-h-0 overflow-y-auto rounded-3xl border border-slate-200/70 bg-white/80 p-4 shadow-sm backdrop-blur-sm scrollbar-hide">
          <div className="space-y-5">
            <CargoInfoCard
              layoutView={layoutView}
              selectedPlacementId={selectedPlacementId}
            />

            <Collapse
              bordered={false}
              defaultActiveKey={["summary"]}
              className="rounded-2xl bg-slate-50/70"
              items={[
                {
                  key: "summary",
                  label: (
                    <Title level={4} style={{ margin: 0 }}>
                      装载摘要
                    </Title>
                  ),
                  children: (
                    <div className="space-y-5 pt-1">
                      <div className="flex flex-wrap gap-2">
                        <Tag color="blue" variant="filled">
                          {selectedPlan.summary.containerCount} 箱
                        </Tag>
                        <Tag color="cyan" variant="filled">
                          平均体积 {formatPercent(selectedPlan.summary.avgVolumeUtilization)}
                        </Tag>
                        <Tag color="green" variant="filled">
                          平均重量 {formatPercent(selectedPlan.summary.avgWeightUtilization)}
                        </Tag>
                        <Tag color="gold" variant="filled">
                          评分 {selectedPlan.summary.totalScore}
                        </Tag>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <Text type="secondary" className="text-xs">
                            箱型组合
                          </Text>
                          <div className="mt-1 font-medium text-slate-900">
                            {selectedPlan.summary.containerMix}
                          </div>
                        </div>
                        <div>
                          <Text type="secondary" className="text-xs">
                            计划总重
                          </Text>
                          <div className="mt-1 font-medium text-slate-900">
                            {selectedPlan.summary.totalWeightKg} kg
                          </div>
                        </div>
                        <div>
                          <Text type="secondary" className="text-xs">
                            计划体积
                          </Text>
                          <div className="mt-1 font-medium text-slate-900">
                            {selectedPlan.summary.totalVolumeCbm} cbm
                          </div>
                        </div>
                        <div>
                          <Text type="secondary" className="text-xs">
                            当前箱货物
                          </Text>
                          <div className="mt-1 font-medium text-slate-900">
                            {selectedContainer.items.length} 件
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-slate-200/70 pt-4">
                        <Text type="secondary" className="text-xs font-semibold">
                          当前箱
                        </Text>
                        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <Text type="secondary" className="text-xs">
                              箱型
                            </Text>
                            <div className="mt-1 font-medium text-slate-900">
                              {selectedContainer.containerType}
                            </div>
                          </div>
                          <div>
                            <Text type="secondary" className="text-xs">
                              内尺寸
                            </Text>
                            <div className="mt-1 font-medium text-slate-900">
                              {selectedContainer.innerLength} x{" "}
                              {selectedContainer.innerWidth} x{" "}
                              {selectedContainer.innerHeight} m
                            </div>
                          </div>
                          <div>
                            <Text type="secondary" className="text-xs">
                              体积利用
                            </Text>
                            <div className="mt-1 font-medium text-slate-900">
                              {formatPercent(selectedContainer.volumeUtilization)}
                            </div>
                          </div>
                          <div>
                            <Text type="secondary" className="text-xs">
                              重量利用
                            </Text>
                            <div className="mt-1 font-medium text-slate-900">
                              {formatPercent(selectedContainer.weightUtilization)}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-slate-200/70 pt-4">
                        <Text type="secondary" className="text-xs font-semibold">
                          风险计划
                        </Text>
                        {selectedPlan.risks.length ? (
                          <div className="mt-3 space-y-2">
                            {selectedPlan.risks.map((risk) => (
                              <div
                                key={`${risk.riskCode}-${risk.targetId}-${risk.message}`}
                                className="rounded-lg bg-white/70 px-3 py-2 text-sm text-slate-700"
                              >
                                <Tag
                                  color={riskColorByLevel[risk.level] ?? "default"}
                                  className="mb-1"
                                >
                                  {risk.level}
                                </Tag>
                                {risk.message}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-3 text-sm text-slate-500">
                            当前计划暂无风险提示。
                          </div>
                        )}
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
            当前箱货物
          </Title>
          <Text type="secondary" className="text-xs">
            切换货物查看卡片与 3D 选中状态
          </Text>
        </div>
        <div className="flex flex-wrap gap-2">
          {layoutView.placements.map((placement) => {
            const item = placement.meta?.item;

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
                {item?.skuCode ?? placement.id}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Cargo3DPage;
