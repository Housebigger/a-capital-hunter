import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useRef } from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type {
  CameraPreset,
  RenderNode,
  SectorId,
  StockRenderNode,
  VoronoiCell,
  VoronoiLayout
} from "../domain/types";
import { CapitalMapScene } from "./CapitalMapScene";
import type { ThemeCell } from "../domain/themeVoronoiLayoutEngine";
import type { ThemeRenderNode } from "../domain/themeRenderNodes";
import type { SubThemeRenderNode } from "../domain/subThemeRenderNodes";
import type { StockRenderNode3 } from "../domain/stockRenderNodes";

export interface HunterSceneProps {
  nodes?: RenderNode[];
  voronoiLayout?: VoronoiLayout;
  stockNodes?: StockRenderNode[];
  themeCells?: ReadonlyArray<ThemeCell>;
  themeNodes?: ThemeRenderNode[];
  subThemeCells?: ReadonlyArray<VoronoiCell>;
  subThemeNodes?: SubThemeRenderNode[];
  stockNodes3?: StockRenderNode3[];
  cameraPreset: CameraPreset;
  selectedSectorId?: SectorId;
  focusSubThemeId?: string;
  onSelectSector: (sectorId: SectorId) => void;
  onFocusSubTheme?: (subThemeId: string | undefined) => void;
}

export function HunterScene(props: HunterSceneProps) {
  const orbitControlsRef = useRef<OrbitControlsImpl | null>(null);

  // Build scene props based on available data
  const sceneProps = (() => {
    if (props.subThemeCells && props.stockNodes3) {
      return {
        mode: "stock" as const,
        themeCells: props.themeCells ?? [],
        voronoiCells: props.subThemeCells,
        stockNodes: props.stockNodes3,
        cameraPreset: props.cameraPreset,
        onSelectSector: props.onSelectSector,
        orbitControlsRef,
      };
    }
    if (props.subThemeCells) {
      return {
        mode: "subtheme" as const,
        themeCells: props.themeCells ?? [],
        voronoiCells: props.subThemeCells,
        subThemeNodes: props.subThemeNodes ?? [],
        cameraPreset: props.cameraPreset,
        onSelectSector: props.onSelectSector,
        orbitControlsRef,
      };
    }
    if (props.themeCells) {
      return {
        mode: "theme" as const,
        themeCells: props.themeCells,
        themeNodes: props.themeNodes ?? [],
        cameraPreset: props.cameraPreset,
        onSelectSector: props.onSelectSector,
        orbitControlsRef,
      };
    }
    if (props.voronoiLayout) {
      return {
        mode: "voronoi" as const,
        voronoiLayout: props.voronoiLayout,
        stockNodes: props.stockNodes ?? [],
        cameraPreset: props.cameraPreset,
        selectedSectorId: props.selectedSectorId,
        focusSubThemeId: props.focusSubThemeId,
        onSelectSector: props.onSelectSector,
        onFocusSubTheme: props.onFocusSubTheme ?? (() => {}),
        orbitControlsRef,
      };
    }
    return {
      mode: undefined as undefined,
      nodes: props.nodes ?? [],
      cameraPreset: props.cameraPreset,
      selectedSectorId: props.selectedSectorId,
      focusSubThemeId: props.focusSubThemeId,
      onSelectSector: props.onSelectSector,
      onFocusSubTheme: props.onFocusSubTheme,
      orbitControlsRef,
    };
  })();

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
