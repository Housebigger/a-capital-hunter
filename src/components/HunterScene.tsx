import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useRef } from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type {
  CameraPreset,
  RenderNode,
  SectorId,
  StockRenderNode,
  VoronoiLayout
} from "../domain/types";
import { CapitalMapScene } from "./CapitalMapScene";
import type { CapitalMapSceneProps } from "./CapitalMapScene";

export interface HunterSceneProps {
  nodes?: RenderNode[];
  voronoiLayout?: VoronoiLayout;
  stockNodes?: StockRenderNode[];
  cameraPreset: CameraPreset;
  selectedSectorId?: SectorId;
  focusSubThemeId?: string;
  onSelectSector: (sectorId: SectorId) => void;
  onFocusSubTheme?: (subThemeId: string | undefined) => void;
}

export function HunterScene(props: HunterSceneProps) {
  const orbitControlsRef = useRef<OrbitControlsImpl | null>(null);

  // Build CapitalMapSceneProps based on available data
  const sceneProps: CapitalMapSceneProps = props.voronoiLayout
    ? {
        mode: "voronoi",
        voronoiLayout: props.voronoiLayout,
        stockNodes: props.stockNodes ?? [],
        cameraPreset: props.cameraPreset,
        selectedSectorId: props.selectedSectorId,
        focusSubThemeId: props.focusSubThemeId,
        onSelectSector: props.onSelectSector,
        onFocusSubTheme: props.onFocusSubTheme ?? (() => {}),
        orbitControlsRef
      }
    : {
        mode: undefined,
        nodes: props.nodes ?? [],
        cameraPreset: props.cameraPreset,
        selectedSectorId: props.selectedSectorId,
        focusSubThemeId: props.focusSubThemeId,
        onSelectSector: props.onSelectSector,
        onFocusSubTheme: props.onFocusSubTheme,
        orbitControlsRef
      };

  return (
    <Canvas
      className="hunter-canvas"
      camera={{ position: [13, 13, 16], fov: 45 }}
      shadows
      gl={{ antialias: true }}
    >
      <color attach="background" args={["#10151b"]} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[8, 12, 8]} intensity={1.2} castShadow />
      <CapitalMapScene {...sceneProps} />
      <OrbitControls
        ref={orbitControlsRef}
        enableDamping
        dampingFactor={0.08}
        maxPolarAngle={Math.PI / 2.15}
      />
    </Canvas>
  );
}
