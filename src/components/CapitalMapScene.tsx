import { Text } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import type { CameraPreset, RenderNode, SectorId } from "../domain/types";

const CELL_SIZE = 0.86;
const COLUMN_SIZE = 0.42;

interface CapitalMapSceneProps {
  nodes: RenderNode[];
  cameraPreset: CameraPreset;
  selectedSectorId?: SectorId;
  onSelectSector: (sectorId: SectorId) => void;
}

const cameraPositions: Record<CameraPreset, [number, number, number]> = {
  angled: [7, 8, 9],
  top: [0, 13, 0.1],
  side: [10, 4, 0]
};

export function CapitalMapScene(props: CapitalMapSceneProps) {
  const { camera } = useThree();

  useEffect(() => {
    const [x, y, z] = cameraPositions[props.cameraPreset];
    camera.position.set(x, y, z);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera, props.cameraPreset]);

  return (
    <group>
      <gridHelper args={[14, 14, "#2d3640", "#1d2630"]} position={[0, -0.02, 0]} />
      {props.nodes.map((node) => (
        <group key={node.sector.id} position={[node.cell.x, 0, node.cell.z]}>
          <mesh
            receiveShadow
            onClick={(event) => {
              event.stopPropagation();
              props.onSelectSector(node.sector.id);
            }}
          >
            <boxGeometry args={[CELL_SIZE, 0.06, CELL_SIZE]} />
            <meshStandardMaterial
              color={node.sector.isThemeCenter ? node.theme.color : "#26313d"}
              opacity={node.visible ? 0.95 : 0.18}
              transparent
              roughness={0.72}
            />
          </mesh>
          <mesh
            castShadow
            position={[0, node.metric.height === 0 ? 0.08 : node.metric.height / 2, 0]}
            visible={node.visible}
          >
            <boxGeometry
              args={[COLUMN_SIZE, Math.max(Math.abs(node.metric.height), 0.08), COLUMN_SIZE]}
            />
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
      ))}
    </group>
  );
}
