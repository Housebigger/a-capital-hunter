import { Text } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";
import * as THREE from "three";
import type { CameraPreset, NormalizedMetric, RenderNode, SectorId } from "../domain/types";

const CELL_SIZE = 0.86;
const COLUMN_SIZE = 0.42;
export const BASE_CELL_THICKNESS = 0.06;
const BASE_CELL_HALF_THICKNESS = BASE_CELL_THICKNESS / 2;
const MIN_COLUMN_HEIGHT = 0.08;

type SceneCamera = {
  position: { set: (x: number, y: number, z: number) => void };
  lookAt: (x: number, y: number, z: number) => void;
  updateProjectionMatrix: () => void;
};
export type SceneOrbitControls = {
  target: { set: (x: number, y: number, z: number) => void };
  update: () => void;
};
type BaseCellClickEvent = {
  stopPropagation: () => void;
};

/* ------------------------------------------------------------------ */
/*  TerrainPlane — country-map coloured base plane                     */
/* ------------------------------------------------------------------ */

function TerrainPlane({ nodes }: { nodes: RenderNode[] }) {
  const geometry = useMemo(() => {
    const size = 24;
    const segments = 48;
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2);

    const positions = geo.attributes.position;
    const colors = new Float32Array(positions.count * 3);

    for (let i = 0; i < positions.count; i++) {
      const vx = positions.getX(i);
      const vz = positions.getZ(i);

      let r = 0,
        g = 0,
        b = 0,
        totalWeight = 0;
      for (const node of nodes) {
        if (!node.visible) continue;
        const dx = vx - node.cell.x;
        const dz = vz - node.cell.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const weight = 1 / Math.max(dist, 0.8);
        const tc = new THREE.Color(node.theme.color);
        r += tc.r * weight;
        g += tc.g * weight;
        b += tc.b * weight;
        totalWeight += weight;
      }

      if (totalWeight > 0) {
        colors[i * 3] = (r / totalWeight) * 0.22;
        colors[i * 3 + 1] = (g / totalWeight) * 0.22;
        colors[i * 3 + 2] = (b / totalWeight) * 0.22;
      }
    }

    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [nodes]);

  return (
    <mesh geometry={geometry} position={[0, -0.03, 0]} receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.85} metalness={0.05} />
    </mesh>
  );
}

/* ------------------------------------------------------------------ */
/*  Label visibility — two-tier density                               */
/* ------------------------------------------------------------------ */

function shouldShowLabel(node: RenderNode, focusSubThemeId?: string): boolean {
  if (node.sector.isThemeCenter) return true;
  if (node.isSubThemeCenter) return true;
  if (focusSubThemeId && node.sector.subThemeId === focusSubThemeId) return true;
  return false;
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface CapitalMapSceneProps {
  nodes: RenderNode[];
  cameraPreset: CameraPreset;
  selectedSectorId?: SectorId;
  focusSubThemeId?: string;
  onSelectSector: (sectorId: SectorId) => void;
  onFocusSubTheme?: (subThemeId: string | undefined) => void;
  orbitControlsRef?: RefObject<SceneOrbitControls | null>;
}

const cameraPositions: Record<CameraPreset, [number, number, number]> = {
  angled: [13, 13, 16],
  top: [0, 22, 0.1],
  side: [18, 7, 0]
};

/* ------------------------------------------------------------------ */
/*  Exported helpers                                                   */
/* ------------------------------------------------------------------ */

export function applyCameraPreset(
  camera: SceneCamera,
  preset: CameraPreset,
  controls?: SceneOrbitControls | null
) {
  const [x, y, z] = cameraPositions[preset];
  camera.position.set(x, y, z);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  controls?.target.set(0, 0, 0);
  controls?.update();
}

export function getColumnRenderGeometry(
  metric: Pick<NormalizedMetric, "height" | "direction">
): { height: number; positionY: number } {
  const height = Math.max(Math.abs(metric.height), MIN_COLUMN_HEIGHT);
  const baseEdge =
    metric.direction === "outflow" ? -BASE_CELL_HALF_THICKNESS : BASE_CELL_HALF_THICKNESS;
  const positionY =
    metric.direction === "outflow" ? baseEdge - height / 2 : baseEdge + height / 2;

  return { height, positionY };
}

export function handleBaseCellClick(
  event: BaseCellClickEvent,
  node: RenderNode,
  onSelectSector: (sectorId: SectorId) => void
) {
  event.stopPropagation();
  if (node.visible) {
    onSelectSector(node.sector.id);
  }
}

/* ------------------------------------------------------------------ */
/*  CapitalMapScene                                                    */
/* ------------------------------------------------------------------ */

export function CapitalMapScene(props: CapitalMapSceneProps) {
  const { camera } = useThree();

  useEffect(() => {
    applyCameraPreset(camera, props.cameraPreset, props.orbitControlsRef?.current);
  }, [camera, props.cameraPreset, props.orbitControlsRef]);

  return (
    <group>
      <TerrainPlane nodes={props.nodes} />
      <gridHelper args={[22, 22, "#1a2030", "#141a24"]} position={[0, -0.01, 0]} />
      {props.nodes.map((node) => {
        const columnGeometry = getColumnRenderGeometry(node.metric);
        const showLabel = shouldShowLabel(node, props.focusSubThemeId);
        const isInFocus =
          !props.focusSubThemeId || node.sector.subThemeId === props.focusSubThemeId;
        const dimFactor = props.focusSubThemeId ? (isInFocus ? 1 : 0.2) : 1;

        return (
          <group key={node.sector.id} position={[node.cell.x, 0, node.cell.z]}>
            <mesh
              receiveShadow
              onClick={(event) => handleBaseCellClick(event, node, props.onSelectSector)}
            >
              <boxGeometry
                args={[
                  node.isSubThemeCenter ? CELL_SIZE * 1.15 : CELL_SIZE,
                  BASE_CELL_THICKNESS,
                  node.isSubThemeCenter ? CELL_SIZE * 1.15 : CELL_SIZE
                ]}
              />
              <meshStandardMaterial
                color={node.sector.isThemeCenter ? node.theme.color : "#26313d"}
                opacity={node.visible ? 0.95 * dimFactor : 0.18}
                transparent
                roughness={0.72}
              />
            </mesh>
            <mesh
              castShadow
              position={[0, columnGeometry.positionY, 0]}
              visible={node.visible}
            >
              <boxGeometry args={[COLUMN_SIZE, columnGeometry.height, COLUMN_SIZE]} />
              <meshStandardMaterial
                color={node.metric.color}
                opacity={node.metric.intensity * dimFactor}
                transparent
                emissive={node.metric.color}
                emissiveIntensity={props.selectedSectorId === node.sector.id ? 0.22 : 0.04}
              />
            </mesh>
            {showLabel && (
              <Text
                position={[0, 0.08, 0.52]}
                rotation={[-Math.PI / 2, 0, 0]}
                fontSize={node.sector.isThemeCenter ? 0.22 : 0.15}
                color={node.visible ? "#e8eef5" : "#64717f"}
                anchorX="center"
                anchorY="middle"
                maxWidth={1.2}
              >
                {node.sector.shortName}
              </Text>
            )}
          </group>
        );
      })}
    </group>
  );
}
