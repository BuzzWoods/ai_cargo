import { Tag, Typography } from "antd";
import type {
  CargoPackingContainer,
  CargoPackingPlan,
} from "../../api/protocol";
import { formatPercent } from "./cargoPackingView";

const { Text, Title } = Typography;

interface CargoContainerSummaryCardProps {
  plan: CargoPackingPlan;
  container: CargoPackingContainer;
}

const labelClassName = "text-xs text-slate-500";
const valueClassName = "mt-1 font-medium text-slate-900";

const CargoContainerSummaryCard = ({
  plan,
  container,
}: CargoContainerSummaryCardProps) => (
  <div className="rounded-2xl border border-amber-100 bg-amber-50/80 p-4 shadow-sm">
    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
      <div>
        <Text type="secondary" className="text-xs font-semibold">
          当前货柜信息
        </Text>
        <Title level={4} style={{ margin: "4px 0 0" }}>
          {container.containerNo}
        </Title>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Tag color="blue" variant="filled" className="m-0">
          {plan.recommended ? "推荐计划" : plan.strategyCode}
        </Tag>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-3 text-sm">
      <div>
        <div className={labelClassName}>计划箱数</div>
        <div className={valueClassName}>{plan.summary.containerCount} 箱</div>
      </div>
      <div>
        <div className={labelClassName}>当前货物</div>
        <div className={valueClassName}>{container.items.length} 件</div>
      </div>
      <div>
        <div className={labelClassName}>平均体积</div>
        <div className={valueClassName}>
          {formatPercent(plan.summary.avgVolumeUtilization)}
        </div>
      </div>
      <div>
        <div className={labelClassName}>平均重量</div>
        <div className={valueClassName}>
          {formatPercent(plan.summary.avgWeightUtilization)}
        </div>
      </div>
      <div>
        <div className={labelClassName}>当前体积利用</div>
        <div className={valueClassName}>
          {formatPercent(container.volumeUtilization)}
        </div>
      </div>
      <div>
        <div className={labelClassName}>当前重量利用</div>
        <div className={valueClassName}>
          {formatPercent(container.weightUtilization)}
        </div>
      </div>
      <div>
        <div className={labelClassName}>计划体积</div>
        <div className={valueClassName}>{plan.summary.totalVolumeCbm} cbm</div>
      </div>
      <div>
        <div className={labelClassName}>计划总重</div>
        <div className={valueClassName}>{plan.summary.totalWeightKg} kg</div>
      </div>
    </div>

    <div className="mt-3 border-t border-amber-100 pt-3 text-sm">
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <div className={labelClassName}>货柜类型</div>
          <div className={valueClassName}>{container.containerType}</div>
        </div>
        <div>
          <div className={labelClassName}>内尺寸</div>
          <div className={valueClassName}>
            {container.innerLength} x {container.innerWidth} x{" "}
            {container.innerHeight} m
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Tag color="cyan" variant="filled" className="m-0">
          {plan.summary.containerMix}
        </Tag>
        <Tag color="green" variant="filled" className="m-0">
          评分 {plan.summary.totalScore}
        </Tag>
      </div>
    </div>
  </div>
);

export default CargoContainerSummaryCard;
