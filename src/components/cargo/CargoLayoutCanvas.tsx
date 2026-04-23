import { Canvas } from "@react-three/fiber";
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
} from "../../api/protocol";

interface CargoLayoutCanvasProps {
  artifact: CargoLayoutArtifact;
  compact?: boolean;
  interactive?: boolean;
  selectedPlacementId?: string | null;
  onPlacementSelect?: (placement: CargoPlacement) => void;
}

const CargoLayoutScene = ({
  artifact,
  interactive = false,
  selectedPlacementId,
  onPlacementSelect,
}: {
  artifact: CargoLayoutArtifact;
  interactive?: boolean;
  selectedPlacementId?: string | null;
  onPlacementSelect?: (placement: CargoPlacement) => void;
}) => {
  const { container, cargoSpecs, placements } = artifact.data;
  const { w, h, d } = container.size;
  const getBoxSize = (cargoId: string) => {
    const spec = cargoSpecs[cargoId];

    if (!spec) {
      return [0.4, 0.4, 0.4] as const;
    }

    return [
      Math.max(spec.dimensions.w, 0.1),
      Math.max(spec.dimensions.h, 0.1),
      Math.max(spec.dimensions.d, 0.1),
    ] as const;
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

      {placements.map((placement) => {
        const selected = placement.id === selectedPlacementId;
        const [boxW, boxH, boxD] = getBoxSize(placement.cargoId);

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
  const containerHeight = artifact.data.container.size.h;
  const floorY = -(containerHeight / 2) - 0.02;
  const sceneVerticalOffset = compact ? 0.7 : 1.25;

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
        <Bounds fit clip observe margin={compact ? 1.15 : 1.25}>
          <group position={[0, sceneVerticalOffset, 0]}>
            <CargoLayoutScene
              artifact={artifact}
              interactive={interactive}
              selectedPlacementId={selectedPlacementId}
              onPlacementSelect={onPlacementSelect}
            />
          </group>
        </Bounds>
        <OrbitControls
          makeDefault
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
