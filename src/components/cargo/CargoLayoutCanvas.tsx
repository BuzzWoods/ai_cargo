import { useRef, useState, type ElementRef } from "react";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import {
  Bounds,
  Edges,
  OrbitControls,
  PerspectiveCamera,
} from "@react-three/drei";
import * as THREE from "three";
import type {
  CargoLayoutArtifact,
  CargoPlacement,
  CargoPosition,
} from "../../api/protocol";
import {
  clampPositionToContainer,
  findCollidingPlacement,
  getBoxSize,
  getPlacementBoxSize,
  normalizeRotationY,
  roundPosition,
  type DragBlockDetail,
  type EditableCargoPlacement,
} from "./cargoLayoutMath";

interface CargoLayoutCanvasProps {
  artifact: CargoLayoutArtifact;
  compact?: boolean;
  interactive?: boolean;
  selectedPlacementId?: string | null;
  onPlacementSelect?: (placement: CargoPlacement) => void;
  onPlacementMove?: (placementId: string, position: CargoPosition) => void;
  onPlacementMoveBlocked?: (detail: DragBlockDetail) => void;
}

interface DragState {
  placementId: string;
  pointerId: number;
  plane: THREE.Plane;
  offset: THREE.Vector3;
  startClientY: number;
  startPosition: CargoPosition;
}

const LIFT_METERS_PER_PIXEL = 0.025;

const stopCameraControlEvent = (event: ThreeEvent<PointerEvent>) => {
  event.stopPropagation();
  event.nativeEvent.preventDefault();
  event.nativeEvent.stopPropagation();
  event.nativeEvent.stopImmediatePropagation();
};

const CargoLayoutScene = ({
  artifact,
  interactive = false,
  selectedPlacementId,
  onPlacementSelect,
  onPlacementMove,
  onPlacementMoveBlocked,
  onDragStateChange,
}: {
  artifact: CargoLayoutArtifact;
  interactive?: boolean;
  selectedPlacementId?: string | null;
  onPlacementSelect?: (placement: CargoPlacement) => void;
  onPlacementMove?: (placementId: string, position: CargoPosition) => void;
  onPlacementMoveBlocked?: (detail: DragBlockDetail) => void;
  onDragStateChange?: (dragging: boolean) => void;
}) => {
  const { container, cargoSpecs, placements } = artifact.data;
  const editablePlacements = placements as EditableCargoPlacement[];
  const { w, h, d } = container.size;
  const dragStateRef = useRef<DragState | null>(null);
  const dragPointRef = useRef(new THREE.Vector3());
  const dragWorldPositionRef = useRef(new THREE.Vector3());
  const [draggingPlacementId, setDraggingPlacementId] = useState<string | null>(
    null,
  );

  const finishDrag = (event: ThreeEvent<PointerEvent>) => {
    const dragState = dragStateRef.current;

    if (!dragState) {
      return;
    }

    stopCameraControlEvent(event);
    (event.target as Element).releasePointerCapture?.(dragState.pointerId);
    dragStateRef.current = null;
    setDraggingPlacementId(null);
    onDragStateChange?.(false);
  };

  const startDrag = (
    event: ThreeEvent<PointerEvent>,
    placement: CargoPlacement,
  ) => {
    stopCameraControlEvent(event);
    onPlacementSelect?.(placement);

    if (!interactive || !onPlacementMove) {
      return;
    }

    event.object.getWorldPosition(dragWorldPositionRef.current);
    const plane = new THREE.Plane(
      new THREE.Vector3(0, 1, 0),
      -dragWorldPositionRef.current.y,
    );
    const hitPoint = event.ray.intersectPlane(plane, dragPointRef.current);

    if (!hitPoint) {
      return;
    }

    (event.target as Element).setPointerCapture?.(event.pointerId);
    dragStateRef.current = {
      placementId: placement.id,
      pointerId: event.pointerId,
      plane,
      offset: new THREE.Vector3(
        placement.position.x - hitPoint.x,
        0,
        placement.position.z - hitPoint.z,
      ),
      startClientY: event.clientY,
      startPosition: placement.position,
    };
    setDraggingPlacementId(placement.id);
    onDragStateChange?.(true);
  };

  const movePlacement = (
    event: ThreeEvent<PointerEvent>,
    placement: CargoPlacement,
  ) => {
    const dragState = dragStateRef.current;

    if (!dragState || dragState.placementId !== placement.id) {
      return;
    }

    stopCameraControlEvent(event);

    const hitPoint = event.ray.intersectPlane(
      dragState.plane,
      dragPointRef.current,
    );

    const editablePlacement = placement as EditableCargoPlacement;
    const movingSize = getPlacementBoxSize(editablePlacement, cargoSpecs);
    let rawPosition: CargoPosition;

    if (event.shiftKey) {
      rawPosition = {
        x: placement.position.x,
        y:
          dragState.startPosition.y -
          (event.clientY - dragState.startClientY) * LIFT_METERS_PER_PIXEL,
        z: placement.position.z,
      };
    } else {
      if (!hitPoint) {
        return;
      }

      rawPosition = {
        x: hitPoint.x + dragState.offset.x,
        y: placement.position.y,
        z: hitPoint.z + dragState.offset.z,
      };
    }

    const { position: boundedPosition, constrained } =
      clampPositionToContainer(rawPosition, movingSize, container.size);
    const collidingPlacement = findCollidingPlacement(
      editablePlacement,
      boundedPosition,
      editablePlacements,
      cargoSpecs,
    );

    if (collidingPlacement) {
      onPlacementMoveBlocked?.({
        placementId: placement.id,
        reason: "collision",
        collidingPlacementId: collidingPlacement.id,
      });
      return;
    }

    onPlacementMove?.(placement.id, roundPosition(boundedPosition));

    if (constrained) {
      onPlacementMoveBlocked?.({
        placementId: placement.id,
        reason: "boundary",
      });
    }
  };

  return (
    <group>
      <mesh>
        <boxGeometry args={[w + 0.02, h + 0.02, d + 0.02]} />
        <meshStandardMaterial
          attach="material-0"
          color="#38bdf8"
          transparent
          opacity={0.12}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
        <meshStandardMaterial
          attach="material-1"
          color="#38bdf8"
          transparent
          opacity={0.12}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
        <meshStandardMaterial
          attach="material-2"
          color="#38bdf8"
          transparent
          opacity={0.12}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
        <meshStandardMaterial
          attach="material-3"
          color="#334155"
          side={THREE.DoubleSide}
        />
        <meshStandardMaterial
          attach="material-4"
          color="#38bdf8"
          transparent
          opacity={0.12}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
        <meshStandardMaterial
          attach="material-5"
          color="#38bdf8"
          transparent
          opacity={0.12}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
        <Edges scale={1} color="#0284c7" />
      </mesh>

      {editablePlacements.map((placement) => {
        const selected =
          placement.id === selectedPlacementId ||
          placement.id === draggingPlacementId;
        const boxSize = getBoxSize(placement.cargoId, cargoSpecs);

        return (
          <mesh
            key={placement.id}
            position={[
              placement.position.x,
              placement.position.y,
              placement.position.z,
            ]}
            rotation={[0, normalizeRotationY(placement.rotationY), 0]}
            onPointerDown={
              interactive ? (event) => startDrag(event, placement) : undefined
            }
            onPointerMove={
              interactive ? (event) => movePlacement(event, placement) : undefined
            }
            onPointerUp={
              interactive ? (event) => finishDrag(event) : undefined
            }
            onPointerCancel={
              interactive ? (event) => finishDrag(event) : undefined
            }
          >
            <boxGeometry args={[boxSize.w, boxSize.h, boxSize.d]} />
            <meshStandardMaterial
              color={placement.color}
              roughness={0.72}
              metalness={0.08}
              emissive={selected ? "#f59e0b" : "#000000"}
              emissiveIntensity={selected ? 0.28 : 0}
            />
            <Edges
              scale={1}
              threshold={2}
              color={selected ? "#f59e0b" : "#0f172a"}
            />
          </mesh>
        );
      })}
    </group>
  );
};

const CargoLayoutCanvas = ({
  artifact,
  compact = false,
  interactive = false,
  selectedPlacementId = null,
  onPlacementSelect,
  onPlacementMove,
  onPlacementMoveBlocked,
}: CargoLayoutCanvasProps) => {
  const containerHeight = artifact.data.container.size.h;
  const floorY = -(containerHeight / 2) - 0.02;
  const sceneVerticalOffset = compact ? 0.7 : 1.25;
  const [isDragging, setIsDragging] = useState(false);
  const controlsRef = useRef<ElementRef<typeof OrbitControls> | null>(null);
  const setDragging = (dragging: boolean) => {
    setIsDragging(dragging);

    if (controlsRef.current) {
      controlsRef.current.enabled = !dragging;
    }
  };

  return (
    <div
      className={`w-full overflow-hidden ${
        compact
          ? "h-72 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-sky-50"
          : "h-full bg-transparent"
      }`}
    >
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        className={
          interactive ? "cursor-grab active:cursor-grabbing" : "cursor-default"
        }
      >
        <color attach="background" args={["#f4f6f8"]} />
        <fog attach="fog" args={["#f4f6f8", 60, 120]} />
        <PerspectiveCamera makeDefault position={[25, 12, 25]} fov={40} />
        <ambientLight intensity={1.4} />
        <hemisphereLight intensity={0.6} groundColor="#cbd5e1" />
        <directionalLight position={[12, 14, 8]} intensity={2.8} />
        <directionalLight position={[-10, 6, -4]} intensity={0.5} />
        <gridHelper
          args={[28, 28, "#cbd5e1", "#e2e8f0"]}
          position={[0, floorY + sceneVerticalOffset, 0]}
        />
        <Bounds key={artifact.id} fit clip margin={compact ? 1.15 : 1.25}>
          <group position={[0, sceneVerticalOffset, 0]}>
            <CargoLayoutScene
              artifact={artifact}
              interactive={interactive}
              selectedPlacementId={selectedPlacementId}
              onPlacementSelect={onPlacementSelect}
              onPlacementMove={onPlacementMove}
              onPlacementMoveBlocked={onPlacementMoveBlocked}
              onDragStateChange={setDragging}
            />
          </group>
        </Bounds>
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enabled={!isDragging}
          enableDamping
          dampingFactor={0.05}
          minDistance={12}
          maxDistance={38}
          target={[0, 0.5, 0]}
          enablePan={interactive}
        />
      </Canvas>
    </div>
  );
};

export default CargoLayoutCanvas;
