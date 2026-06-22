import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useRef } from "react";
import { TOUCH } from "three";
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
  compact?: boolean;
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
        compact: props.compact ?? false,
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
        compact: props.compact ?? false,
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
        compact: props.compact ?? false,
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
        compact: props.compact ?? false,
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
      compact: props.compact ?? false,
    };
  })();

  return (
    <Canvas
      className="hunter-canvas"
      camera={{ position: [13, 13, 16], fov: 45 }}
      shadows
      gl={{ antialias: true }}
      dpr={[1, 2]}
    >
      <color attach="background" args={["#10151b"]} />
      <ambientLight intensity={0.7} />
      {/* Desktop keeps three.js's default 512 shadow map (unchanged); mobile
          uses a lighter 256 map to cheapen the shadow pass. */}
      <directionalLight
        position={[8, 12, 8]}
        intensity={1.2}
        castShadow
        shadow-mapSize={props.compact ? [256, 256] : undefined}
      />
      <CapitalMapScene {...sceneProps} />
      <OrbitControls
        ref={orbitControlsRef}
        enableDamping
        dampingFactor={0.08}
        maxPolarAngle={Math.PI / 2.15}
        touches={
          props.compact
            ? // Omitting ONE disables single-finger gestures so one finger
              // scrolls the page; two fingers rotate + pinch-zoom. (This
              // @types/three TOUCH enum lacks the runtime `NONE` member, and an
              // undefined ONE is the type-safe equivalent of TOUCH.NONE.)
              { TWO: TOUCH.DOLLY_ROTATE }
            : { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN }
        }
      />
    </Canvas>
  );
}
