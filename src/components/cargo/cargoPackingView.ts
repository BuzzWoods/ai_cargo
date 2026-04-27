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
  cargoSpecs: Record<string, CargoSpec>;
  placements: CargoPlacement[];
  plan: CargoPackingPlan;
  packingContainer: CargoPackingContainer;
}

const palette = [
  "#60a5fa",
  "#34d399",
  "#fbbf24",
  "#fb7185",
  "#a78bfa",
  "#2dd4bf",
  "#f97316",
  "#94a3b8",
];

const hashString = (value: string) => {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
};

const getItemColor = (item: CargoPackingItem) =>
  palette[hashString(item.skuCode || item.boxId) % palette.length];

export const toDecimalNumber = (
  value: number | string | Decimal,
  decimalPlaces = 6,
) =>
  new Decimal(value).toDecimalPlaces(decimalPlaces).toNumber();

export const formatDecimal = (value: number, decimalPlaces = 3) =>
  new Decimal(value).toDecimalPlaces(decimalPlaces).toString();

export const formatPercent = (value: number) => {
  const normalized = value > 1 ? value : value * 100;

  return `${normalized.toFixed(0)}%`;
};

export const isCargoPackingPlansArtifact = (
  artifact: CargoPackingPlansArtifact | null | undefined,
): artifact is CargoPackingPlansArtifact =>
  Array.isArray(artifact?.data?.plans);

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

export const createCargoLayoutView = (
  artifact: CargoPackingPlansArtifact | null,
  plan: CargoPackingPlan | null,
  packingContainer: CargoPackingContainer | null,
): CargoLayoutView | null => {
  if (!isCargoPackingPlansArtifact(artifact) || !plan || !packingContainer) {
    return null;
  }

  const cargoSpecs = Object.fromEntries(
    packingContainer.items.map((item) => [
      item.boxId,
      {
        weightKg: item.weightKg,
        dimensions: {
          w: item.length,
          h: item.height,
          d: item.width,
        },
        volumeM3: item.volumeCbm,
      },
    ]),
  );
  const placements = packingContainer.items.map((item) => ({
    id: item.boxId,
    cargoId: item.boxId,
    position: {
      x: toDecimalNumber(
        new Decimal(item.x)
          .minus(new Decimal(packingContainer.innerLength).div(2))
          .plus(new Decimal(item.length).div(2)),
      ),
      y: toDecimalNumber(
        new Decimal(item.z)
          .minus(new Decimal(packingContainer.innerHeight).div(2))
          .plus(new Decimal(item.height).div(2)),
      ),
      z: toDecimalNumber(
        new Decimal(item.y)
          .minus(new Decimal(packingContainer.innerWidth).div(2))
          .plus(new Decimal(item.width).div(2)),
      ),
    },
    color: getItemColor(item),
    meta: {
      item,
    },
  }));

  return {
    id: `${artifact.id}:${plan.planNo}:${packingContainer.containerNo}`,
    title: artifact.title,
    container: {
      id: packingContainer.containerNo,
      size: {
        w: packingContainer.innerLength,
        h: packingContainer.innerHeight,
        d: packingContainer.innerWidth,
      },
      unit: "m",
    },
    cargoSpecs,
    placements,
    plan,
    packingContainer,
  };
};
