import { Tag, Typography } from "antd";
import type { CargoLayoutArtifact } from "../../api/protocol";

const { Text } = Typography;

interface CargoInfoCardProps {
  artifact: CargoLayoutArtifact;
  selectedPlacementId: string | null;
}

const boolTag = (label: string) => (
  <Tag
    color="green"
    variant="filled"
    className="m-0 rounded-md px-2 py-0.5 text-[12px] leading-5"
  >
    {label}
  </Tag>
);

const fieldLabelClassName = "text-[11px] font-semibold uppercase tracking-wide text-slate-500";

const CargoInfoCard = ({
  artifact,
  selectedPlacementId,
}: CargoInfoCardProps) => {
  const { cargoBasicInfos, cargoSpecs, placements } = artifact.data;
  const cargoInfoById = new Map(cargoBasicInfos.map((item) => [item.id, item]));
  const placement =
    placements.find((item) => item.id === selectedPlacementId) ??
    placements[0] ??
    null;

  if (!placement) {
    return <Text type="secondary">暂无可展示的货物，请先在 3D 视图中生成装箱结果。</Text>;
  }

  const cargo = cargoInfoById.get(placement.cargoId);
  const spec = cargoSpecs[placement.cargoId];

  if (!cargo || !spec) {
    return <Text type="secondary">当前货物信息不完整，无法展示详细内容。</Text>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          货物信息
        </div>
        <div className="text-lg font-semibold text-slate-900">
          {cargo.name}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Tag
          color="blue"
          variant="filled"
          className="m-0 rounded-md px-2 py-0.5 text-[12px] leading-5"
        >
          {cargo.sku}
        </Tag>
        {cargo.category ? (
          <Tag
            color="cyan"
            variant="filled"
            className="m-0 rounded-md px-2 py-0.5 text-[12px] leading-5"
          >
            {cargo.category}
          </Tag>
        ) : null}
        <Tag
          color="gold"
          variant="filled"
          className="m-0 rounded-md px-2 py-0.5 text-[12px] leading-5"
        >
          {cargo.packageType}
        </Tag>
        <Tag
          color="geekblue"
          variant="filled"
          className="m-0 rounded-md px-2 py-0.5 text-[12px] leading-5"
        >
          数量 {cargo.quantity}
        </Tag>
      </div>

      {cargo.meta?.note ? (
        <div className="text-sm text-slate-500">{cargo.meta.note}</div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 border-t border-slate-100 pt-4">
          <div className={fieldLabelClassName}>属性</div>
          <div className="flex flex-wrap gap-1.5">
            {cargo.stackable ? boolTag("可堆叠") : null}
            {cargo.fragile ? boolTag("易碎") : null}
            {cargo.dangerousGoods ? boolTag("危品") : null}
            {cargo.temperatureControlled ? boolTag("温控") : null}
            {!cargo.stackable &&
            !cargo.fragile &&
            !cargo.dangerousGoods &&
            !cargo.temperatureControlled ? (
              <Text type="secondary" className="text-xs">
                无特殊属性
              </Text>
            ) : null}
          </div>
        </div>

        <div className="space-y-2 border-t border-slate-100 pt-4">
          <div className={fieldLabelClassName}>位置与规格</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm text-slate-700">
            <div>
              <Text type="secondary" className="text-xs">
                重量
              </Text>
              <div className="mt-1 font-medium text-slate-900">
                {spec.weightKg} kg
              </div>
            </div>
            <div>
              <Text type="secondary" className="text-xs">
                尺寸
              </Text>
              <div className="mt-1 font-medium text-slate-900">
                {spec.dimensions.w} × {spec.dimensions.h} × {spec.dimensions.d}
              </div>
            </div>
            <div>
              <Text type="secondary" className="text-xs">
                体积
              </Text>
              <div className="mt-1 font-medium text-slate-900">
                {spec.volumeM3?.toFixed(3) ?? "未提供"} m³
              </div>
            </div>
            <div>
              <Text type="secondary" className="text-xs">
                颜色
              </Text>
              <div className="mt-1 flex items-center font-medium text-slate-900">
                <span
                  className="mr-2 inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: placement.color }}
                />
                {placement.color}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 border-t border-slate-100 pt-4 md:grid-cols-2">
        <div>
          <Text type="secondary" className="text-xs">
            来源
          </Text>
          <div className="mt-1 font-medium text-slate-900">
            {cargo.origin ?? "未提供"}
          </div>
        </div>
        <div>
          <Text type="secondary" className="text-xs">
            目的地
          </Text>
          <div className="mt-1 font-medium text-slate-900">
            {cargo.destination ?? "未提供"}
          </div>
        </div>
        <div>
          <Text type="secondary" className="text-xs">
            货物位置
          </Text>
          <div className="mt-1 font-medium text-slate-900">
            {placement.position.x}, {placement.position.y}, {placement.position.z}
          </div>
        </div>
        <div>
          <Text type="secondary" className="text-xs">
            摆位备注
          </Text>
          <div className="mt-1 font-medium text-slate-900">
            {placement.meta?.note ?? "无"}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CargoInfoCard;
