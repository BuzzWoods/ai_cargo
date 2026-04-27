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

export const formatPercent = (value: number) => {
  const normalized = value > 1 ? value : value * 100;

  return `${normalized.toFixed(0)}%`;
};

export const getPreferredPlan = (artifact: CargoPackingPlansArtifact) =>
  artifact.data.plans.find(
    (plan) =>
      plan.recommended || plan.planNo === artifact.data.recommendedPlanNo,
  ) ??
  artifact.data.plans[0] ??
  null;

export const getPlanByNo = (
  artifact: CargoPackingPlansArtifact,
  planNo: string | null,
) =>
  artifact.data.plans.find((plan) => plan.planNo === planNo) ??
  getPreferredPlan(artifact);

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
  if (!artifact || !plan || !packingContainer) {
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
        x: item.x - packingContainer.innerLength / 2 + item.length / 2,
        y: item.z - packingContainer.innerHeight / 2 + item.height / 2,
        z: item.y - packingContainer.innerWidth / 2 + item.width / 2,
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
