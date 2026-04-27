import { Tag, Typography } from "antd";
import { formatDecimal, type CargoLayoutView } from "./cargoPackingView";

const { Text } = Typography;

interface CargoInfoCardProps {
  layoutView: CargoLayoutView;
  selectedPlacementId: string | null;
}

const fieldLabelClassName =
  "text-[11px] font-semibold uppercase tracking-wide text-slate-500";

const formatPoint = (values: number[]) =>
  values.map((value) => formatDecimal(value, 3)).join(", ");

const CargoInfoCard = ({
  layoutView,
  selectedPlacementId,
}: CargoInfoCardProps) => {
  const placement =
    layoutView.placements.find((item) => item.id === selectedPlacementId) ??
    layoutView.placements[0] ??
    null;

  if (!placement) {
    return <Text type="secondary">当前箱子暂无货物明细。</Text>;
  }

  const item = placement.meta?.item;
  const spec = layoutView.cargoSpecs[placement.cargoId];

  if (!item || !spec) {
    return <Text type="secondary">当前货物信息不完整，无法展示详细内容。</Text>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          货物信息
        </div>
        <div className="text-lg font-semibold text-slate-900">
          {item.skuName}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Tag color="blue" variant="filled" className="m-0 rounded-md px-2 py-0.5">
          {item.skuCode}
        </Tag>
        <Tag color="cyan" variant="filled" className="m-0 rounded-md px-2 py-0.5">
          {item.boxId}
        </Tag>
        <Tag color="gold" variant="filled" className="m-0 rounded-md px-2 py-0.5">
          箱数 {item.cartonCount}
        </Tag>
      </div>

      <div className="grid gap-4 border-t border-slate-100 pt-4 md:grid-cols-2">
        <div>
          <div className={fieldLabelClassName}>工厂</div>
          <div className="mt-1 font-medium text-slate-900">
            {item.factoryCode}
          </div>
        </div>
        <div>
          <div className={fieldLabelClassName}>仓库</div>
          <div className="mt-1 font-medium text-slate-900">
            {item.warehouseCode}
          </div>
        </div>
        <div>
          <div className={fieldLabelClassName}>重量</div>
          <div className="mt-1 font-medium text-slate-900">
            {spec.weightKg} kg
          </div>
        </div>
        <div>
          <div className={fieldLabelClassName}>体积</div>
          <div className="mt-1 font-medium text-slate-900">
            {item.volumeCbm.toFixed(3)} cbm
          </div>
        </div>
        <div>
          <div className={fieldLabelClassName}>尺寸</div>
          <div className="mt-1 font-medium text-slate-900">
            {item.length} x {item.width} x {item.height} m
          </div>
        </div>
        <div>
          <div className={fieldLabelClassName}>旋转类型</div>
          <div className="mt-1 font-medium text-slate-900">
            {item.rotateType}
          </div>
        </div>
      </div>

      <div className="grid gap-4 border-t border-slate-100 pt-4 md:grid-cols-2">
        <div>
          <Text type="secondary" className="text-xs">
            后端坐标
          </Text>
          <div className="mt-1 font-medium text-slate-900">
            {formatPoint([item.x, item.y, item.z])}
          </div>
        </div>
        <div>
          <Text type="secondary" className="text-xs">
            视图中心点
          </Text>
          <div className="mt-1 font-medium text-slate-900">
            {formatPoint([
              placement.position.x,
              placement.position.y,
              placement.position.z,
            ])}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CargoInfoCard;
