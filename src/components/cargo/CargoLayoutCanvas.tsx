import { useLayoutEffect, useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import {
  Edges,
  OrbitControls,
  PerspectiveCamera,
} from "@react-three/drei";
import Decimal from "decimal.js";
import * as THREE from "three";
import type { CargoPlacement } from "../../api/protocol";
import {
  decimalMaxNumber,
  toDecimalNumber,
  type CargoLayoutView,
} from "./cargoPackingView";

interface CargoLayoutCanvasProps {
  artifact: CargoLayoutView;
  compact?: boolean;
  interactive?: boolean;
  selectedPlacementId?: string | null;
  onPlacementSelect?: (placement: CargoPlacement) => void;
}

const getBoxSize = (artifact: CargoLayoutView, cargoId: string) => {
  const spec = artifact.cargoSpecs[cargoId];

  if (!spec) {
    return [0.4, 0.4, 0.4] as const;
  }

  return [
    decimalMaxNumber(spec.dimensions.w, 0.1),
    decimalMaxNumber(spec.dimensions.h, 0.1),
    decimalMaxNumber(spec.dimensions.d, 0.1),
  ] as const;
};

const VIEW_ANGLE_DEG = 40;
const CAMERA_FOV_DEG = 40;

// 根据当前集装箱尺寸计算初始相机位置，让不同箱型尽量都能完整进入视野。
const getCameraConfig = (
  artifact: CargoLayoutView,
  sceneVerticalOffset: number,
) => {
  const { w, h, d } = artifact.container.size;
  const fovRadians = toDecimalNumber(
    new Decimal(CAMERA_FOV_DEG).mul(Math.PI).div(180),
  );
  const angleRadians = toDecimalNumber(
    new Decimal(VIEW_ANGLE_DEG).mul(Math.PI).div(180),
  );
  const radius = toDecimalNumber(
    new Decimal(w)
      .pow(2)
      .plus(new Decimal(h).pow(2))
      .plus(new Decimal(d).pow(2))
      .sqrt()
      .div(2),
  );
  const distance = decimalMaxNumber(
    new Decimal(radius)
      .div(Math.sin(toDecimalNumber(new Decimal(fovRadians).div(2))))
      .mul(1.18),
    10,
  );
  const horizontalDistance = toDecimalNumber(
    new Decimal(distance).mul(Math.cos(angleRadians)),
  );
  const cameraHeight = toDecimalNumber(
    new Decimal(distance).mul(Math.sin(angleRadians)),
  );
  const diagonalDistance = toDecimalNumber(
    new Decimal(horizontalDistance).div(Math.SQRT2),
  );
  const target: [number, number, number] = [
    0,
    toDecimalNumber(
      new Decimal(sceneVerticalOffset).plus(new Decimal(h).mul(0.08)),
    ),
    0,
  ];
  const position: [number, number, number] = [
    diagonalDistance,
    toDecimalNumber(new Decimal(target[1]).plus(cameraHeight)),
    diagonalDistance,
  ];

  return {
    position,
    target,
    maxDistance: decimalMaxNumber(new Decimal(distance).mul(2.5), 24),
  };
};

const CargoCamera = ({
  position,
  target,
}: {
  position: [number, number, number];
  target: [number, number, number];
}) => {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);

  useLayoutEffect(() => {
    // useLayoutEffect 在绘制前同步相机，减少首次进入 3D 页面时的抖动。
    const camera = cameraRef.current;

    if (!camera) {
      return;
    }

    camera.position.set(...position);
    camera.lookAt(...target);
    camera.updateProjectionMatrix();
  }, [position, target]);

  return (
    <PerspectiveCamera
      ref={cameraRef}
      makeDefault
      position={position}
      fov={CAMERA_FOV_DEG}
    />
  );
};

const CargoLayoutScene = ({
  artifact,
  interactive = false,
  selectedPlacementId,
  onPlacementSelect,
}: {
  artifact: CargoLayoutView;
  interactive?: boolean;
  selectedPlacementId?: string | null;
  onPlacementSelect?: (placement: CargoPlacement) => void;
}) => {
  const { container, placements } = artifact;
  const { w, h, d } = container.size;

  return (
    <group>
      {/* 集装箱外框：底面深色，其余面透明，方便看清内部货物堆叠。 */}
      <mesh>
        <boxGeometry
          args={[
            toDecimalNumber(new Decimal(w).plus(0.02)),
            toDecimalNumber(new Decimal(h).plus(0.02)),
            toDecimalNumber(new Decimal(d).plus(0.02)),
          ]}
        />
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

      {placements.map((placement) => {
        // 每个 placement 对应一个箱体 mesh；点击 mesh 会同步右侧货物信息卡片。
        const selected = placement.id === selectedPlacementId;
        const [boxW, boxH, boxD] = getBoxSize(artifact, placement.cargoId);

        return (
          <mesh
            key={placement.id}
            position={[
              placement.position.x,
              placement.position.y,
              placement.position.z,
            ]}
            onPointerDown={
              interactive
                ? (event) => {
                    event.stopPropagation();
                    onPlacementSelect?.(placement);
                  }
                : undefined
            }
          >
            <boxGeometry args={[boxW, boxH, boxD]} />
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
}: CargoLayoutCanvasProps) => {
  // compact 用于聊天小卡片，完整页则撑满工作区并开启交互选择。
  const containerHeight = artifact.container.size.h;
  const floorY = toDecimalNumber(
    new Decimal(containerHeight)
      .div(2)
      .negated()
      .minus(0.02),
  );
  const sceneVerticalOffset = compact ? 0.7 : 1.25;
  const cameraConfig = useMemo(
    () => getCameraConfig(artifact, sceneVerticalOffset),
    [artifact, sceneVerticalOffset],
  );

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
        className={interactive ? "cursor-pointer" : "cursor-default"}
      >
        <color attach="background" args={["#f4f6f8"]} />
        <fog attach="fog" args={["#f4f6f8", 60, 120]} />
        <CargoCamera
          position={cameraConfig.position}
          target={cameraConfig.target}
        />
        <ambientLight intensity={1.4} />
        <hemisphereLight intensity={0.6} groundColor="#cbd5e1" />
        <directionalLight position={[12, 14, 8]} intensity={2.8} />
        <directionalLight position={[-10, 6, -4]} intensity={0.5} />
        <gridHelper
          args={[28, 28, "#cbd5e1", "#e2e8f0"]}
          position={[
            0,
            toDecimalNumber(new Decimal(floorY).plus(sceneVerticalOffset)),
            0,
          ]}
        />
        <group position={[0, sceneVerticalOffset, 0]}>
          <CargoLayoutScene
            artifact={artifact}
            interactive={interactive}
            selectedPlacementId={selectedPlacementId}
            onPlacementSelect={onPlacementSelect}
          />
        </group>
        <OrbitControls
          key={artifact.id}
          makeDefault
          enableDamping
          dampingFactor={0.05}
          minDistance={12}
          maxDistance={cameraConfig.maxDistance}
          target={cameraConfig.target}
          enablePan={interactive}
        />
      </Canvas>
    </div>
  );
};

export default CargoLayoutCanvas;
