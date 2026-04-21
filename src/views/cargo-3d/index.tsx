import React, { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  Box,
  Environment,
  Edges,
  PerspectiveCamera,
} from "@react-three/drei";
import * as THREE from "three";

// 货物数据结构
interface CargoItem {
  /** 货物的唯一标识，用作 React 循环渲染时的 key 以及业务追踪 */
  id: string;
  /** 货物的宽度尺寸（占据 X 轴的长度） */
  w: number;
  /** 货物的高度尺寸（占据 Y 轴的长度） */
  h: number;
  /** 货物的深度/长度尺寸（占据 Z 轴的长度） */
  d: number;
  /** 货物表面渲染时的外观颜色值（通常为 HEX 十六进制代码，如 "#fb7185"） */
  color: string;
  /** 货物放置在 3D 集装箱内部的绝对几何中心坐标 [x, y, z] */
  position: [number, number, number];
}

const BOX_TYPES = [
  { w: 1, h: 1, d: 1, c: "#fb7185" }, // 粉红 (1x1x1)
  { w: 2, h: 1, d: 1, c: "#60a5fa" }, // 蓝 (2x1x1)
  { w: 1, h: 1, d: 2, c: "#34d399" }, // 绿 (1x1x2)
  { w: 1, h: 2, d: 1, c: "#fbbf24" }, // 黄 (1x2x1)
  { w: 2, h: 2, d: 1, c: "#a78bfa" }, // 紫 (2x2x1)
];

const CONTAINER_W = 16;
const CONTAINER_H = 6;
const CONTAINER_D = 6;

const CargoScene = () => {
  const cargos = useMemo(() => {
    // 简单的 3D 贪心堆叠算法，模拟在集装箱内从下到上摆放 200 个不同尺寸货物
    const grid = new Array(CONTAINER_W)
      .fill(0)
      .map(() =>
        new Array(CONTAINER_H)
          .fill(0)
          .map(() => new Array(CONTAINER_D).fill(false)),
      );

    const result: CargoItem[] = [];
    let boxId = 0;

    for (let i = 0; i < 200; i++) {
      const type = BOX_TYPES[Math.floor(Math.random() * BOX_TYPES.length)];
      let placed = false;

      // 遍历寻找空位摆放 (按层数 Y 从下往上，以此带来稳固堆叠视觉)
      for (let y = 0; y < CONTAINER_H && !placed; y++) {
        for (let z = 0; z < CONTAINER_D && !placed; z++) {
          for (let x = 0; x < CONTAINER_W && !placed; x++) {
            if (
              x + type.w <= CONTAINER_W &&
              y + type.h <= CONTAINER_H &&
              z + type.d <= CONTAINER_D
            ) {
              let fits = true;
              for (let dy = 0; dy < type.h; dy++) {
                for (let dz = 0; dz < type.d; dz++) {
                  for (let dx = 0; dx < type.w; dx++) {
                    if (grid[x + dx][y + dy][z + dz]) fits = false;
                  }
                }
              }
              if (fits) {
                // 标记空间为已占据!
                for (let dy = 0; dy < type.h; dy++) {
                  for (let dz = 0; dz < type.d; dz++) {
                    for (let dx = 0; dx < type.w; dx++) {
                      grid[x + dx][y + dy][z + dz] = true;
                    }
                  }
                }
                result.push({
                  id: `cargo-${boxId++}`,
                  w: type.w,
                  h: type.h,
                  d: type.d,
                  color: type.c,
                  position: [
                    x + type.w / 2 - CONTAINER_W / 2,
                    y + type.h / 2 - CONTAINER_H / 2,
                    z + type.d / 2 - CONTAINER_D / 2,
                  ],
                });
                placed = true;
              }
            }
          }
        }
      }
    }
    return result;
  }, []);

  console.log("cargos", cargos);

  return (
    <group>
      {/* 外部集装箱大 Box: 极其轻微地放大一点点体积 (0.02) 来防止它与内部货物的底面发生图形重叠闪烁 (Z-fighting) */}
      <mesh>
        <boxGeometry
          args={[CONTAINER_W + 0.02, CONTAINER_H + 0.02, CONTAINER_D + 0.02]}
        />
        {/* materials[0] - Right */}
        <meshStandardMaterial
          attach="material-0"
          color="#38bdf8"
          transparent
          opacity={0.1}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
        {/* materials[1] - Left */}
        <meshStandardMaterial
          attach="material-1"
          color="#38bdf8"
          transparent
          opacity={0.1}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
        {/* materials[2] - Top */}
        <meshStandardMaterial
          attach="material-2"
          color="#38bdf8"
          transparent
          opacity={0.1}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
        {/* materials[3] - Bottom 面：100%实体，用较深的灰色表示集装箱承重底盘 */}
        <meshStandardMaterial
          attach="material-3"
          color="#475569"
          side={THREE.DoubleSide}
        />
        {/* materials[4] - Front */}
        <meshStandardMaterial
          attach="material-4"
          color="#38bdf8"
          transparent
          opacity={0.1}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
        {/* materials[5] - Back */}
        <meshStandardMaterial
          attach="material-5"
          color="#38bdf8"
          transparent
          opacity={0.1}
          depthWrite={false}
          side={THREE.DoubleSide}
        />

        {/* 集装箱的框架线 */}
        <Edges scale={1.0} color="#0284c7" />
      </mesh>

      {/* 内部渲染出来的 200个货物实例 */}
      {cargos.map((cargo) => (
        <Box
          key={cargo.id}
          args={[cargo.w, cargo.h, cargo.d]}
          position={cargo.position}
        >
          <meshStandardMaterial
            color={cargo.color}
            roughness={0.7}
            metalness={0.1}
          />
          {/* 每个货物都带一点细轮廓边展示层次 */}
          <Edges scale={1} threshold={2} color="#0f172a" />
        </Box>
      ))}
    </group>
  );
};

const Cargo3DPage: React.FC = () => {
  return (
    <div className="w-full h-full min-h-[600px] bg-slate-50 flex flex-col">
      <div className="p-4 bg-white border-b shadow-sm z-10 relative">
        <h2 className="text-xl font-bold m-0 text-gray-800">
          装箱积载视图 3D Demo
        </h2>
        <p className="text-gray-500 m-0 mt-1 text-sm">
          拖拽鼠标进行 360° 旋转，滚动鼠标滚轮缩放。系统自动以最优排列方式装载
          200 个五种不同体积的随机货物。
        </p>
      </div>
      <div className="flex-1 w-full h-full relative cursor-move">
        <Canvas>
          {/* 这里特意把相机向后拉远，足以看下整个 16x6x6 的集装箱 */}
          <PerspectiveCamera makeDefault position={[18, 14, 20]} fov={45}>
            {/* 因为去掉了环境贴图，这里适当调高基础环境光强度 */}
            <ambientLight intensity={1.5} />
            <directionalLight
              position={[10, 10, 5]}
              intensity={3.5}
              castShadow
            />
            <pointLight
              position={[2, 2, 5]}
              intensity={2.5}
              distance={30}
              color="#e0f2fe"
            />
            <directionalLight position={[-10, -5, 0]} intensity={0.5} />
          </PerspectiveCamera>
          <CargoScene />
          <OrbitControls makeDefault enableDamping dampingFactor={0.05} />
        </Canvas>
      </div>
    </div>
  );
};

export default Cargo3DPage;
