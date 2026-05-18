import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  Button,
  Empty,
  Select,
  Tag,
  Typography,
  Tooltip,
} from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import type { CargoPackingPlansArtifact } from "../../api/protocol";
import CargoLayoutCanvas from "./CargoLayoutCanvas";
import CargoContainerSummaryCard from "./CargoContainerSummaryCard";
import CargoInfoCard from "./CargoInfoCard";
import {
  createCargoPackingSceneView,
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
  selectedPlanNo?: string | null;
  selectedContainerNo?: string | null;
  onSelectionChange?: (selection: {
    planNo: string | null;
    containerNo: string | null;
  }) => void;
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
  selectedPlanNo,
  selectedContainerNo,
  onSelectionChange,
}) => {
  const [internalSelectedPlanNo, setInternalSelectedPlanNo] = useState<
    string | null
  >(null);
  const [internalSelectedContainerNo, setInternalSelectedContainerNo] =
    useState<string | null>(null);
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(
    null,
  );

  // 页面打开时默认定位到推荐计划和它的第一个箱子。
  const preferredPlan = artifact ? getPreferredPlan(artifact) : null;
  const preferredPlanNo = preferredPlan?.planNo ?? null;
  const preferredContainerNo = preferredPlan?.containers[0]?.containerNo ?? null;
  const currentSelectedPlanNo =
    selectedPlanNo === undefined ? internalSelectedPlanNo : selectedPlanNo;
  const currentSelectedContainerNo =
    selectedContainerNo === undefined
      ? internalSelectedContainerNo
      : selectedContainerNo;
  const selectedPlan = artifact
    ? getPlanByNo(artifact, currentSelectedPlanNo)
    : null;
  const selectedContainer = getContainerByNo(
    selectedPlan,
    currentSelectedContainerNo,
  );
  const layoutView = useMemo(
    () => createCargoPackingSceneView(artifact, selectedPlan, selectedContainer),
    [artifact, selectedContainer, selectedPlan],
  );
  const layoutViewId = layoutView?.id ?? null;
  const currentContainerPlacementId =
    layoutView?.placements.find(
      (placement) =>
        placement.meta?.packingContainer?.containerNo ===
        selectedContainer?.containerNo,
    )?.id ?? null;
  const firstPlacementId =
    currentContainerPlacementId ?? layoutView?.placements[0]?.id ?? null;
  const currentContainerPlacements = useMemo(
    () =>
      layoutView?.placements.filter(
        (placement) =>
          placement.meta?.packingContainer?.containerNo ===
          selectedContainer?.containerNo,
      ) ?? [],
    [layoutView, selectedContainer],
  );
  const currentCargoOptions = useMemo(
    () =>
      currentContainerPlacements.map((placement) => {
        const item = placement.meta?.item;
        const labelParts = [
          item?.skuCode,
          item?.boxId && item.boxId !== item.skuCode ? item.boxId : null,
          item?.skuName,
        ].filter(Boolean);

        return {
          label: labelParts.join(" / ") || placement.id,
          value: placement.id,
        };
      }),
    [currentContainerPlacements],
  );
  const updateSelection = useCallback(
    (nextPlanNo: string | null, nextContainerNo: string | null) => {
      setInternalSelectedPlanNo(nextPlanNo);
      setInternalSelectedContainerNo(nextContainerNo);
      onSelectionChange?.({
        planNo: nextPlanNo,
        containerNo: nextContainerNo,
      });
    },
    [onSelectionChange],
  );

  useEffect(() => {
    // 切换 artifact 后重置计划/箱子选择，避免还拿着上一个方案的编号。
    updateSelection(preferredPlanNo, preferredContainerNo);
  }, [artifact, preferredContainerNo, preferredPlanNo, updateSelection]);

  useEffect(() => {
    // 切换计划时，如果原来的箱号不存在，自动回到该计划第一个箱子。
    if (!selectedPlan) {
      if (currentSelectedContainerNo !== null) {
        updateSelection(currentSelectedPlanNo, null);
      }
      return;
    }

    const currentContainer = getContainerByNo(
      selectedPlan,
      currentSelectedContainerNo,
    );
    const nextContainerNo = currentContainer?.containerNo ?? null;

    if (
      currentSelectedPlanNo !== selectedPlan.planNo ||
      currentSelectedContainerNo !== nextContainerNo
    ) {
      updateSelection(selectedPlan.planNo, nextContainerNo);
    }
  }, [
    currentSelectedContainerNo,
    currentSelectedPlanNo,
    selectedPlan,
    updateSelection,
  ]);

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
          <div className="flex shrink-0 flex-wrap items-end gap-4 rounded-3xl p-4 backdrop-blur-sm">
            <div className="min-w-[220px] space-y-2">
              <Text type="secondary" className="text-xs font-semibold">
                装箱计划：
              </Text>
              <Select
                value={selectedPlan.planNo}
                className="w-full"
                options={artifact.data.plans.map((plan) => ({
                  label: `${plan.planNo}${plan.recommended ? " 推荐" : ""}`,
                  value: plan.planNo,
                }))}
                onChange={(value) => {
                  const nextPlan = artifact.data.plans.find(
                    (plan) => plan.planNo === String(value),
                  );
                  updateSelection(
                    String(value),
                    nextPlan?.containers[0]?.containerNo ?? null,
                  );
                }}
              />
            </div>

            <div className="min-w-[220px] space-y-2">
              <Text type="secondary" className="text-xs font-semibold">
                货柜：
              </Text>
              <Select
                value={selectedContainer.containerNo}
                className="w-full"
                options={selectedPlan.containers.map((container) => ({
                  label: `${container.containerNo} ${container.containerType}`,
                  value: container.containerNo,
                }))}
                onChange={(value) =>
                  updateSelection(selectedPlan.planNo, String(value))
                }
              />
            </div>

            <div className="w-[360px] max-w-full space-y-2">
              <Text type="secondary" className="text-xs font-semibold">
                当前货物：
              </Text>
              <Select
                value={selectedPlacementId}
                options={currentCargoOptions}
                onChange={(value) => setSelectedPlacementId(value)}
                disabled={!currentCargoOptions.length}
                showSearch
                optionFilterProp="label"
                placeholder="当前货柜暂无货物明细"
                className="w-full"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden rounded-3xl bg-white/40 backdrop-blur-sm">
            <CargoLayoutCanvas
              artifact={layoutView}
              interactive
              selectedPlacementId={selectedPlacementId}
              selectedContainerNo={selectedContainer.containerNo}
              onPlacementSelect={(placement) =>
                setSelectedPlacementId(placement.id)
              }
            />
          </div>
        </div>

        <div className="h-full min-h-0 space-y-4 overflow-y-auto pr-1 scrollbar-hide">
          <CargoContainerSummaryCard
            plan={selectedPlan}
            container={selectedContainer}
          />

          <CargoInfoCard
            layoutView={layoutView}
            selectedPlacementId={selectedPlacementId}
          />

          <div className="rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-sm">
            <Title level={4} style={{ margin: 0 }}>
              风险提示
            </Title>
            <div className="mt-3">
              {selectedPlan.risks.length ? (
                <div className="space-y-2">
                  {selectedPlan.risks.map((risk) => (
                    <div
                      key={`${risk.riskCode}-${risk.targetId}-${risk.message}`}
                      className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700"
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
                <div className="text-sm text-slate-500">
                  当前计划暂无风险提示。
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default CargoPackingPreviewWorkspace;
