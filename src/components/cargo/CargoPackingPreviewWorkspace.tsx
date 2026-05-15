import React, { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Button,
  Collapse,
  Empty,
  Segmented,
  Tag,
  Typography,
  Tooltip,
} from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import type { CargoPackingPlansArtifact } from "../../api/protocol";
import CargoLayoutCanvas from "./CargoLayoutCanvas";
import CargoInfoCard from "./CargoInfoCard";
import {
  createCargoLayoutView,
  formatPercent,
  getContainerByNo,
  getPlanByNo,
  getPreferredPlan,
} from "./cargoPackingView";

const { Paragraph, Text, Title } = Typography;

const riskColorByLevel: Record<string, string> = {
  high: "red",
  medium: "orange",
  low: "blue",
  warning: "orange",
  error: "red",
};

interface CargoPackingPreviewWorkspaceProps {
  artifact: CargoPackingPlansArtifact | null;
  emptyDescription: ReactNode;
  emptyAction?: ReactNode;
  headerExtra?: ReactNode;
  onBack?: () => void;
  backTooltip?: string;
  title?: string;
}

const CargoPackingPreviewWorkspace: React.FC<
  CargoPackingPreviewWorkspaceProps
> = ({
  artifact,
  emptyDescription,
  emptyAction,
  headerExtra,
  onBack,
  backTooltip = "返回",
  title = "装箱三维预览",
}) => {
  const [selectedPlanNo, setSelectedPlanNo] = useState<string | null>(null);
  const [selectedContainerNo, setSelectedContainerNo] = useState<string | null>(
    null,
  );
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(
    null,
  );

  // 页面打开时默认定位到推荐计划和它的第一个箱子。
  const preferredPlan = artifact ? getPreferredPlan(artifact) : null;
  const preferredPlanNo = preferredPlan?.planNo ?? null;
  const preferredContainerNo = preferredPlan?.containers[0]?.containerNo ?? null;
  const selectedPlan = artifact ? getPlanByNo(artifact, selectedPlanNo) : null;
  const selectedContainer = getContainerByNo(selectedPlan, selectedContainerNo);
  const layoutView = useMemo(
    () => createCargoLayoutView(artifact, selectedPlan, selectedContainer),
    [artifact, selectedContainer, selectedPlan],
  );
  const layoutViewId = layoutView?.id ?? null;
  const firstPlacementId = layoutView?.placements[0]?.id ?? null;

  useEffect(() => {
    // 切换 artifact 后重置计划/箱子选择，避免还拿着上一个方案的编号。
    setSelectedPlanNo(preferredPlanNo);
    setSelectedContainerNo(preferredContainerNo);
  }, [artifact, preferredContainerNo, preferredPlanNo]);

  useEffect(() => {
    // 切换计划时，如果原来的箱号不存在，自动回到该计划第一个箱子。
    if (!selectedPlan) {
      setSelectedContainerNo(null);
      return;
    }

    const currentContainer = getContainerByNo(selectedPlan, selectedContainerNo);
    const nextContainerNo = currentContainer?.containerNo ?? null;

    setSelectedContainerNo((current) =>
      current === nextContainerNo ? current : nextContainerNo,
    );
  }, [selectedContainerNo, selectedPlan]);

  useEffect(() => {
    // 切换箱子后默认选中第一件货物，让右侧信息卡有明确上下文。
    setSelectedPlacementId(firstPlacementId);
  }, [firstPlacementId, layoutViewId]);

  if (!artifact || !layoutView || !selectedPlan || !selectedContainer) {
    return (
      <div className="flex h-full min-h-[600px] items-center justify-center bg-transparent p-6">
        <Empty
          description={emptyDescription}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          {emptyAction}
        </Empty>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-transparent px-6 py-4">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {onBack ? (
              <Tooltip title={backTooltip}>
                <Button
                  type="text"
                  icon={<ArrowLeftOutlined />}
                  onClick={onBack}
                  className="flex items-center justify-center text-slate-400 hover:text-slate-600"
                  style={{ width: 32, height: 32 }}
                />
              </Tooltip>
            ) : null}
            <Title level={3} style={{ margin: 0 }}>
              {title}
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
          {headerExtra}
        </div>
      </div>

      <div className="grid flex-1 min-h-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-h-0 flex-col gap-3">
          <div className="shrink-0 space-y-3 rounded-3xl p-4 backdrop-blur-sm">
            <div className="space-y-2">
              <Text type="secondary" className="text-xs font-semibold">
                装箱计划：
              </Text>
              <Segmented
                value={selectedPlan.planNo}
                className="w-fit max-w-full"
                options={artifact.data.plans.map((plan) => ({
                  label: `${plan.planNo}${plan.recommended ? " 推荐" : ""}`,
                  value: plan.planNo,
                }))}
                onChange={(value) => {
                  const nextPlan = artifact.data.plans.find(
                    (plan) => plan.planNo === String(value),
                  );
                  setSelectedPlanNo(String(value));
                  setSelectedContainerNo(
                    nextPlan?.containers[0]?.containerNo ?? null,
                  );
                }}
              />
            </div>

            <div className="space-y-2">
              <Text type="secondary" className="text-xs font-semibold">
                货箱：
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

          <div className="min-h-0 flex-1 overflow-hidden rounded-3xl bg-white/40 backdrop-blur-sm">
            <CargoLayoutCanvas
              artifact={layoutView}
              interactive
              selectedPlacementId={selectedPlacementId}
              onPlacementSelect={(placement) =>
                setSelectedPlacementId(placement.id)
              }
            />
          </div>
        </div>

        <div className="h-full min-h-0 overflow-y-auto rounded-3xl border border-slate-200/70 bg-white/80 p-4 shadow-sm backdrop-blur-sm scrollbar-hide">
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
                          平均体积{" "}
                          {formatPercent(
                            selectedPlan.summary.avgVolumeUtilization,
                          )}
                        </Tag>
                        <Tag color="green" variant="filled">
                          平均重量{" "}
                          {formatPercent(
                            selectedPlan.summary.avgWeightUtilization,
                          )}
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
                        <Text
                          type="secondary"
                          className="text-xs font-semibold"
                        >
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
                              {formatPercent(
                                selectedContainer.volumeUtilization,
                              )}
                            </div>
                          </div>
                          <div>
                            <Text type="secondary" className="text-xs">
                              重量利用
                            </Text>
                            <div className="mt-1 font-medium text-slate-900">
                              {formatPercent(
                                selectedContainer.weightUtilization,
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-slate-200/70 pt-4">
                        <Text
                          type="secondary"
                          className="text-xs font-semibold"
                        >
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
                                  color={
                                    riskColorByLevel[risk.level] ?? "default"
                                  }
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

export default CargoPackingPreviewWorkspace;
