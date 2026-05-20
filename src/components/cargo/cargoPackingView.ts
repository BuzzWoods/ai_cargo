import Decimal from "decimal.js";
import type {
  CargoContainer,
  CargoPackingContainer,
  CargoPackingItem,
  CargoPackingPlan,
  CargoPackingPlansArtifact,
  CargoPlacement,
  CargoSpec,
} from "../../api/protocol";

export interface CargoLayoutView {
  id: string;
  title: string;
  container: CargoContainer;
  containers: CargoLayoutContainerView[];
  cargoSpecs: Record<string, CargoSpec>;
  placements: CargoPlacement[];
  plan: CargoPackingPlan;
  packingContainer: CargoPackingContainer;
}

export interface CargoLayoutContainerView {
  id: string;
  label: string;
  container: CargoContainer;
  packingContainer: CargoPackingContainer;
  labelDepth: number;
  labelFontSize: number;
  offset: {
    x: number;
    y: number;
    z: number;
  };
  grid: {
    row: number;
    column: number;
  };
}

// 现代精美且区分度极高的颜色调色盘，共12种颜色，并经过合理的冷暖/明暗交替排序，保证高对比度
const palette = [
  "#3b82f6", // 0: 活力蓝 (Vibrant Blue)
  "#f97316", // 1: 活力橙 (Vibrant Orange)
  "#10b981", // 2: 翡翠绿 (Emerald Green)
  "#ec4899", // 3: 亮丽粉 (Vivid Pink)
  "#eab308", // 4: 暖金色 (Warm Gold)
  "#8b5cf6", // 5: 深紫色 (Deep Purple)
  "#06b6d4", // 6: 电性青 (Electric Cyan)
  "#ef4444", // 7: 绯红色 (Crimson Red)
  "#6366f1", // 8: 皇家靛 (Royal Indigo)
  "#84cc16", // 9: 亮柠绿 (Bright Lime)
  "#0f766e", // 10: 暗青绿 (Dark Teal)
  "#d946ef", // 11: 洋红色 (Magenta)
];

const hashString = (value: string) => {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
};

// 获取货箱颜色。如果传入了当前计划下的唯一 SKU 排序列表，则通过跳步算法分配极具对比度的稳定颜色；
// 否则，回退到基于 SKU 或 boxId 哈希的稳定颜色分配。
const getItemColor = (item: CargoPackingItem, uniqueSkus?: string[]) => {
  const identifier = item.skuCode || item.boxId;
  if (uniqueSkus && uniqueSkus.length > 0) {
    const index = uniqueSkus.indexOf(identifier);
    if (index !== -1) {
      // 使用步长 5（与调色盘大小 12 互质），确保相邻的 SKU 能够映射到调色盘中距离极远的颜色上，彻底避免相邻色
      return palette[(index * 5) % palette.length];
    }
  }
  return palette[hashString(identifier) % palette.length];
};

const getPlacementId = (
  packingContainer: CargoPackingContainer,
  item: CargoPackingItem,
) => `${packingContainer.containerNo}:${item.boxId}`;

// 坐标/尺寸/百分比统一经过 Decimal，减少 0.15500000000000008 这类浮点尾巴。
export const toDecimalNumber = (
  value: number | string | Decimal,
  decimalPlaces = 6,
) =>
  new Decimal(value).toDecimalPlaces(decimalPlaces).toNumber();

export const formatDecimal = (value: number, decimalPlaces = 3) =>
  new Decimal(value).toDecimalPlaces(decimalPlaces).toString();

export const decimalMaxNumber = (
  firstValue: number | string | Decimal,
  ...values: Array<number | string | Decimal>
) =>
  values
    .reduce<Decimal>(
      (maxValue, value) => Decimal.max(maxValue, new Decimal(value)),
      new Decimal(firstValue),
    )
    .toNumber();

export const formatPercent = (value: number) => {
  const decimalValue = new Decimal(value);
  const normalized = decimalValue.gt(1)
    ? decimalValue
    : decimalValue.mul(100);

  return `${normalized.toDecimalPlaces(0).toString()}%`;
};

export const isCargoPackingPlansArtifact = (
  artifact: CargoPackingPlansArtifact | null | undefined,
): artifact is CargoPackingPlansArtifact =>
  Array.isArray(artifact?.data?.plans);

// 多计划入口：优先展示后端推荐计划，没有推荐时兜底展示第一个计划。
export const getPreferredPlan = (
  artifact: CargoPackingPlansArtifact | null | undefined,
) => {
  if (!isCargoPackingPlansArtifact(artifact)) {
    return null;
  }

  return artifact.data.plans.find(
    (plan) =>
      plan.recommended || plan.planNo === artifact.data.recommendedPlanNo,
  ) ??
    artifact.data.plans[0] ??
    null;
};

export const getPlanByNo = (
  artifact: CargoPackingPlansArtifact | null | undefined,
  planNo: string | null,
) => {
  if (!isCargoPackingPlansArtifact(artifact)) {
    return null;
  }

  return (
    artifact.data.plans.find((plan) => plan.planNo === planNo) ??
    getPreferredPlan(artifact)
  );
};

export const getContainerByNo = (
  plan: CargoPackingPlan | null,
  containerNo: string | null,
) =>
  plan?.containers.find((container) => container.containerNo === containerNo) ??
  plan?.containers[0] ??
  null;

const createPlacement = (
  packingContainer: CargoPackingContainer,
  item: CargoPackingItem,
  offset = { x: 0, y: 0, z: 0 },
  uniqueSkus?: string[],
): CargoPlacement => {
  const placementId = getPlacementId(packingContainer, item);
  const cargoId = placementId;

  return {
    id: placementId,
    cargoId,
    position: {
      x: toDecimalNumber(
        new Decimal(item.x)
          .minus(new Decimal(packingContainer.innerLength).div(2))
          .plus(new Decimal(item.length).div(2))
          .plus(offset.x),
      ),
      y: toDecimalNumber(
        new Decimal(item.z)
          .minus(new Decimal(packingContainer.innerHeight).div(2))
          .plus(new Decimal(item.height).div(2))
          .plus(offset.y),
      ),
      z: toDecimalNumber(
        new Decimal(item.y)
          .minus(new Decimal(packingContainer.innerWidth).div(2))
          .plus(new Decimal(item.width).div(2))
          .plus(offset.z),
      ),
    },
    color: getItemColor(item, uniqueSkus),
    meta: {
      item,
      packingContainer,
    },
  };
};

const createCargoSpec = (item: CargoPackingItem): CargoSpec => ({
  weightKg: item.weightKg,
  dimensions: {
    w: item.length,
    h: item.height,
    d: item.width,
  },
  volumeM3: item.volumeCbm,
});

// 获取计划中所有货物的唯一 SKU 列表并排序，用于稳定且高区分度的颜色映射
export const getUniqueSkusInPlan = (plan: CargoPackingPlan | null) => {
  if (!plan) {
    return [];
  }
  const skus = new Set<string>();
  plan.containers.forEach((container) => {
    container.items.forEach((item) => {
      skus.add(item.skuCode || item.boxId);
    });
  });
  return Array.from(skus).sort();
};

export const createCargoLayoutView = (
  artifact: CargoPackingPlansArtifact | null,
  plan: CargoPackingPlan | null,
  packingContainer: CargoPackingContainer | null,
): CargoLayoutView | null => {
  if (!isCargoPackingPlansArtifact(artifact) || !plan || !packingContainer) {
    return null;
  }

  const uniqueSkus = getUniqueSkusInPlan(plan);

  // 后端给的是箱内后端坐标；这里转换成 three.js 的中心点坐标，供 mesh.position 使用。
  const cargoSpecs = Object.fromEntries(
    packingContainer.items.map((item) => [
      getPlacementId(packingContainer, item),
      createCargoSpec(item),
    ]),
  );
  const placements = packingContainer.items.map((item) =>
    createPlacement(packingContainer, item, { x: 0, y: 0, z: 0 }, uniqueSkus),
  );
  const container: CargoContainer = {
    id: packingContainer.containerNo,
    size: {
      w: packingContainer.innerLength,
      h: packingContainer.innerHeight,
      d: packingContainer.innerWidth,
    },
    unit: "m",
  };

  return {
    id: `${artifact.id}:${plan.planNo}:${packingContainer.containerNo}`,
    title: artifact.title,
    container,
    containers: [
      {
        id: packingContainer.containerNo,
        label: `${packingContainer.containerNo} ${packingContainer.containerType}`,
        container,
        packingContainer,
        labelDepth: decimalMaxNumber(
          new Decimal(packingContainer.innerWidth).mul(0.24),
          0.9,
        ),
        labelFontSize: decimalMaxNumber(
          0.36,
          Decimal.min(
            new Decimal(0.62),
            new Decimal(packingContainer.innerLength).mul(0.045),
          ),
        ),
        offset: { x: 0, y: 0, z: 0 },
        grid: { row: 0, column: 0 },
      },
    ],
    cargoSpecs,
    placements,
    plan,
    packingContainer,
  };
};

const GRID_COLUMNS = 3;

export const createCargoPackingSceneView = (
  artifact: CargoPackingPlansArtifact | null,
  plan: CargoPackingPlan | null,
  selectedContainer: CargoPackingContainer | null,
): CargoLayoutView | null => {
  if (!isCargoPackingPlansArtifact(artifact) || !plan) {
    return null;
  }

  const packingContainers = plan.containers;

  if (!packingContainers.length) {
    return null;
  }

  const currentContainer =
    packingContainers.find(
      (container) => container.containerNo === selectedContainer?.containerNo,
    ) ?? packingContainers[0];
  const columnCount = Math.min(GRID_COLUMNS, packingContainers.length);
  const rowCount = Math.ceil(packingContainers.length / GRID_COLUMNS);
  const maxLength = decimalMaxNumber(
    0,
    ...packingContainers.map((container) => container.innerLength),
  );
  const maxWidth = decimalMaxNumber(
    0,
    ...packingContainers.map((container) => container.innerWidth),
  );
  const maxHeight = decimalMaxNumber(
    0,
    ...packingContainers.map((container) => container.innerHeight),
  );
  const labelDepth = decimalMaxNumber(new Decimal(maxWidth).mul(0.26), 1);
  const labelFontSize = decimalMaxNumber(
    0.36,
    Decimal.min(new Decimal(0.62), new Decimal(maxLength).mul(0.045)),
  );
  const gapX = decimalMaxNumber(new Decimal(maxLength).mul(0.24), 1.8);
  const gapZ = decimalMaxNumber(new Decimal(maxWidth).mul(0.2), 1.1);
  const sceneWidth = toDecimalNumber(
    new Decimal(columnCount)
      .mul(maxLength)
      .plus(new Decimal(columnCount - 1).mul(gapX)),
  );
  const sceneDepth = toDecimalNumber(
    new Decimal(rowCount)
      .mul(maxWidth)
      .plus(new Decimal(rowCount).mul(labelDepth))
      .plus(new Decimal(rowCount - 1).mul(gapZ)),
  );
  const containerViews = packingContainers.map((packingContainer, index) => {
    const column = index % GRID_COLUMNS;
    const row = Math.floor(index / GRID_COLUMNS);
    const offset = {
      x: toDecimalNumber(
        new Decimal(column)
          .mul(new Decimal(maxLength).plus(gapX))
          .minus(new Decimal(sceneWidth).div(2))
          .plus(new Decimal(maxLength).div(2)),
      ),
      y: 0,
      z: toDecimalNumber(
        new Decimal(row)
          .mul(new Decimal(maxWidth).plus(labelDepth).plus(gapZ))
          .minus(new Decimal(sceneDepth).div(2))
          .plus(new Decimal(maxWidth).div(2)),
      ),
    };
    const container: CargoContainer = {
      id: packingContainer.containerNo,
      size: {
        w: packingContainer.innerLength,
        h: packingContainer.innerHeight,
        d: packingContainer.innerWidth,
      },
      unit: "m",
    };

    return {
      id: packingContainer.containerNo,
      label: `${packingContainer.containerNo} ${packingContainer.containerType}`,
      container,
      packingContainer,
      labelDepth,
      labelFontSize,
      offset,
      grid: { row, column },
    };
  });
  const cargoSpecs = Object.fromEntries(
    packingContainers.flatMap((packingContainer) =>
      packingContainer.items.map((item) => [
        getPlacementId(packingContainer, item),
        createCargoSpec(item),
      ]),
    ),
  );
  const uniqueSkus = getUniqueSkusInPlan(plan);
  const placements = containerViews.flatMap((containerView) =>
    containerView.packingContainer.items.map((item) =>
      createPlacement(
        containerView.packingContainer,
        item,
        containerView.offset,
        uniqueSkus,
      ),
    ),
  );

  return {
    id: `${artifact.id}:${plan.planNo}:scene`,
    title: artifact.title,
    container: {
      id: `${plan.planNo}-scene`,
      size: {
        w: sceneWidth,
        h: maxHeight,
        d: sceneDepth,
      },
      unit: "m",
    },
    containers: containerViews,
    cargoSpecs,
    placements,
    plan,
    packingContainer: currentContainer,
  };
};
