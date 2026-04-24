import type {
  CargoDimensions,
  CargoLayoutArtifact,
  CargoPlacement,
  CargoPosition,
} from "../../api/protocol";

export type CargoSpecs = CargoLayoutArtifact["data"]["cargoSpecs"];
export type DragBlockReason = "boundary" | "collision";

export interface EditableCargoPlacement extends CargoPlacement {
  rotationY?: number;
}

export interface DragBlockDetail {
  placementId: string;
  reason: DragBlockReason;
  collidingPlacementId?: string;
}

const COLLISION_EPSILON = 0.001;
const POSITION_PRECISION = 1000;
const RIGHT_ANGLE = Math.PI / 2;
const FULL_TURN = Math.PI * 2;

const clamp = (value: number, min: number, max: number) => {
  if (min > max) {
    return (min + max) / 2;
  }

  return Math.min(Math.max(value, min), max);
};

export const roundPosition = (position: CargoPosition): CargoPosition => ({
  x: Math.round(position.x * POSITION_PRECISION) / POSITION_PRECISION,
  y: Math.round(position.y * POSITION_PRECISION) / POSITION_PRECISION,
  z: Math.round(position.z * POSITION_PRECISION) / POSITION_PRECISION,
});

export const normalizeRotationY = (rotationY = 0) => {
  const normalized = rotationY % FULL_TURN;

  return normalized < 0 ? normalized + FULL_TURN : normalized;
};

export const rotateRightAngle = (rotationY = 0) =>
  normalizeRotationY(rotationY + RIGHT_ANGLE);

export const getBoxSize = (
  cargoId: string,
  cargoSpecs: CargoSpecs,
): CargoDimensions => {
  const spec = cargoSpecs[cargoId];

  if (!spec) {
    return { w: 0.4, h: 0.4, d: 0.4 };
  }

  return {
    w: Math.max(spec.dimensions.w, 0.1),
    h: Math.max(spec.dimensions.h, 0.1),
    d: Math.max(spec.dimensions.d, 0.1),
  };
};

export const getEffectiveBoxSize = (
  cargoId: string,
  cargoSpecs: CargoSpecs,
  rotationY = 0,
): CargoDimensions => {
  const boxSize = getBoxSize(cargoId, cargoSpecs);
  const quarterTurns = Math.round(normalizeRotationY(rotationY) / RIGHT_ANGLE) % 4;

  if (quarterTurns % 2 === 0) {
    return boxSize;
  }

  return {
    w: boxSize.d,
    h: boxSize.h,
    d: boxSize.w,
  };
};

export const getPlacementBoxSize = (
  placement: EditableCargoPlacement,
  cargoSpecs: CargoSpecs,
) => getEffectiveBoxSize(placement.cargoId, cargoSpecs, placement.rotationY);

export const clampPositionToContainer = (
  position: CargoPosition,
  boxSize: CargoDimensions,
  containerSize: CargoDimensions,
) => {
  const nextPosition = {
    x: clamp(
      position.x,
      -(containerSize.w / 2) + boxSize.w / 2,
      containerSize.w / 2 - boxSize.w / 2,
    ),
    y: clamp(
      position.y,
      -(containerSize.h / 2) + boxSize.h / 2,
      containerSize.h / 2 - boxSize.h / 2,
    ),
    z: clamp(
      position.z,
      -(containerSize.d / 2) + boxSize.d / 2,
      containerSize.d / 2 - boxSize.d / 2,
    ),
  };

  return {
    position: nextPosition,
    constrained:
      nextPosition.x !== position.x ||
      nextPosition.y !== position.y ||
      nextPosition.z !== position.z,
  };
};

const intersectsBox = (
  firstPosition: CargoPosition,
  firstSize: CargoDimensions,
  secondPosition: CargoPosition,
  secondSize: CargoDimensions,
) =>
  Math.abs(firstPosition.x - secondPosition.x) <
    (firstSize.w + secondSize.w) / 2 - COLLISION_EPSILON &&
  Math.abs(firstPosition.y - secondPosition.y) <
    (firstSize.h + secondSize.h) / 2 - COLLISION_EPSILON &&
  Math.abs(firstPosition.z - secondPosition.z) <
    (firstSize.d + secondSize.d) / 2 - COLLISION_EPSILON;

export const findCollidingPlacement = (
  movingPlacement: EditableCargoPlacement,
  nextPosition: CargoPosition,
  placements: EditableCargoPlacement[],
  cargoSpecs: CargoSpecs,
) => {
  const movingSize = getPlacementBoxSize(movingPlacement, cargoSpecs);

  return placements.find((placement) => {
    if (placement.id === movingPlacement.id) {
      return false;
    }

    return intersectsBox(
      nextPosition,
      movingSize,
      placement.position,
      getPlacementBoxSize(placement, cargoSpecs),
    );
  });
};
