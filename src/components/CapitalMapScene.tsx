import { Text } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import type { RefObject } from "react";
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

interface CapitalMapSceneProps {
  nodes: RenderNode[];
  cameraPreset: CameraPreset;
  selectedSectorId?: SectorId;
  onSelectSector: (sectorId: SectorId) => void;
  orbitControlsRef?: RefObject<SceneOrbitControls | null>;
}

const cameraPositions: Record<CameraPreset, [number, number, number]> = {
  angled: [7, 8, 9],
  top: [0, 13, 0.1],
  side: [10, 4, 0]
};

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

export function CapitalMapScene(props: CapitalMapSceneProps) {
  const { camera } = useThree();

  useEffect(() => {
    applyCameraPreset(camera, props.cameraPreset, props.orbitControlsRef?.current);
  }, [camera, props.cameraPreset, props.orbitControlsRef]);

  return (
    <group>
      <gridHelper args={[14, 14, "#2d3640", "#1d2630"]} position={[0, -0.02, 0]} />
      {props.nodes.map((node) => {
        const columnGeometry = getColumnRenderGeometry(node.metric);

        return (
          <group key={node.sector.id} position={[node.cell.x, 0, node.cell.z]}>
            <mesh
              receiveShadow
              onClick={(event) => handleBaseCellClick(event, node, props.onSelectSector)}
            >
              <boxGeometry args={[CELL_SIZE, BASE_CELL_THICKNESS, CELL_SIZE]} />
              <meshStandardMaterial
                color={node.sector.isThemeCenter ? node.theme.color : "#26313d"}
                opacity={node.visible ? 0.95 : 0.18}
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
                opacity={node.metric.intensity}
                transparent
                emissive={node.metric.color}
                emissiveIntensity={props.selectedSectorId === node.sector.id ? 0.22 : 0.04}
              />
            </mesh>
            <Text
              position={[0, 0.08, 0.52]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.18}
              color={node.visible ? "#e8eef5" : "#64717f"}
              anchorX="center"
              anchorY="middle"
              maxWidth={1.2}
            >
              {node.sector.shortName}
            </Text>
          </group>
        );
      })}
    </group>
  );
}
