import { Canvas } from "@react-three/fiber";
import {
  Bounds,
  Edges,
  OrbitControls,
  PerspectiveCamera,
} from "@react-three/drei";
import * as THREE from "three";
import type { CargoLayoutArtifact } from "../../api/protocol";

interface CargoLayoutCanvasProps {
  artifact: CargoLayoutArtifact;
  compact?: boolean;
}

const CargoLayoutScene = ({ artifact }: { artifact: CargoLayoutArtifact }) => {
  const { container, items } = artifact.data;
  const { w, h, d } = container.size;

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

      {items.map((item) => (
        <mesh
          key={item.id}
          position={[item.position.x, item.position.y, item.position.z]}
        >
          <boxGeometry args={[item.size.w, item.size.h, item.size.d]} />
          <meshStandardMaterial
            color={item.color}
            roughness={0.7}
            metalness={0.08}
          />
          <Edges scale={1} threshold={2} color="#0f172a" />
        </mesh>
      ))}
    </group>
  );
};

const CargoLayoutCanvas = ({
  artifact,
  compact = false,
}: CargoLayoutCanvasProps) => (
  <div
    className={`w-full overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-sky-50 ${
      compact ? "h-72" : "h-[560px]"
    }`}
  >
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      <color attach="background" args={["#f8fbff"]} />
      <fog attach="fog" args={["#f8fbff", 28, 44]} />
      <PerspectiveCamera makeDefault position={[20, 16, 22]} fov={42} />
      <ambientLight intensity={1.4} />
      <hemisphereLight intensity={0.6} groundColor="#cbd5e1" />
      <directionalLight position={[12, 14, 8]} intensity={2.8} />
      <directionalLight position={[-10, 6, -4]} intensity={0.5} />
      <gridHelper args={[28, 28, "#cbd5e1", "#e2e8f0"]} position={[0, -3.02, 0]} />
      <Bounds fit clip observe margin={compact ? 1.15 : 1.25}>
        <CargoLayoutScene artifact={artifact} />
      </Bounds>
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.05}
        minDistance={8}
        maxDistance={48}
      />
    </Canvas>
  </div>
);

export default CargoLayoutCanvas;
