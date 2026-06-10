import { Text } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo } from "react";
import type { RefObject } from "react";
import * as THREE from "three";
import { subThemes as subThemeList } from "../domain/subThemeRegistry";
import { themes as themeList } from "../domain/themeRegistry";
import type {
  CameraPreset,
  NormalizedMetric,
  RenderNode,
  SectorId,
  StockRenderNode,
  VoronoiCell,
  VoronoiLayout
} from "../domain/types";

/* ================================================================== */
/*  Constants                                                          */
/* ================================================================== */

const CELL_SIZE = 0.86;
const COLUMN_SIZE = 0.42;
export const BASE_CELL_THICKNESS = 0.06;
const BASE_CELL_HALF_THICKNESS = BASE_CELL_THICKNESS / 2;
const MIN_COLUMN_HEIGHT = 0.08;
const STOCK_CYLINDER_RADIUS = 0.12;
const STOCK_CYLINDER_SEGMENTS = 8;

/* ================================================================== */
/*  Camera & types                                                     */
/* ================================================================== */

export const cameraPositions: Record<CameraPreset, [number, number, number]> = {
  angled: [18, 18, 22],
  top: [0, 28, 0.1],
  side: [24, 9, 0]
};

/**
 * Legacy camera positions kept for backward compatibility with tests
 * that were written against the Gen3 grid layout.
 */
export const legacyCameraPositions: Record<CameraPreset, [number, number, number]> = {
  angled: [13, 13, 16],
  top: [0, 22, 0.1],
  side: [18, 7, 0]
};

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

/* ================================================================== */
/*  Exported helpers (backward compatibility)                           */
/* ================================================================== */

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

/* ================================================================== */
/*  VoronoiPlate — single Voronoi cell as extruded polygon              */
/* ================================================================== */

function VoronoiPlate({
  cell,
  themeColor,
  opacity,
  onClick
}: {
  cell: VoronoiCell;
  themeColor: string;
  opacity: number;
  onClick?: () => void;
}) {
  const shape = useMemo(() => {
    const poly = cell.polygon;
    if (poly.length < 3) return null;
    const s = new THREE.Shape();
    s.moveTo(poly[0].x - cell.center.x, poly[0].z - cell.center.z);
    for (let i = 1; i < poly.length; i++) {
      s.lineTo(poly[i].x - cell.center.x, poly[i].z - cell.center.z);
    }
    s.closePath();
    return s;
  }, [cell]);

  if (!shape) return null;

  return (
    <mesh
      position={[cell.center.x, 0.04, cell.center.z]}
      rotation={[Math.PI / 2, 0, 0]}
      receiveShadow
      onClick={onClick}
    >
      <extrudeGeometry args={[shape, { depth: 0.08, bevelEnabled: false }]} />
      <meshStandardMaterial
        color={themeColor}
        opacity={opacity}
        transparent
        roughness={0.75}
      />
    </mesh>
  );
}

/* ================================================================== */
/*  ProvinceBorderLine — outline segments between different-theme      */
/*  adjacent cells                                                      */
/* ================================================================== */

function ProvinceBorderLine({
  cell,
  neighborCells,
  color
}: {
  cell: VoronoiCell;
  neighborCells: ReadonlyArray<VoronoiCell>;
  color: string;
}) {
  const geometry = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const poly = cell.polygon;
    if (poly.length < 3) {
      const emptyGeo = new THREE.BufferGeometry();
      return emptyGeo;
    }

    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const mx = (a.x + b.x) / 2;
      const mz = (a.z + b.z) / 2;

      let nearestOtherTheme = false;
      let minDist = Infinity;
      for (const nb of neighborCells) {
        if (nb.subThemeId === cell.subThemeId) continue;
        const dx = mx - nb.center.x;
        const dz = mz - nb.center.z;
        const dist = dx * dx + dz * dz;
        if (dist < minDist) {
          minDist = dist;
          nearestOtherTheme = nb.themeId !== cell.themeId;
        }
      }

      if (nearestOtherTheme) {
        points.push(new THREE.Vector3(a.x, 0.09, a.z));
        points.push(new THREE.Vector3(b.x, 0.09, b.z));
      }
    }

    const geo = new THREE.BufferGeometry();
    if (points.length > 0) {
      const positions = new Float32Array(points.length * 3);
      for (let i = 0; i < points.length; i++) {
        positions[i * 3] = points[i].x;
        positions[i * 3 + 1] = points[i].y;
        positions[i * 3 + 2] = points[i].z;
      }
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    }
    return geo;
  }, [cell.polygon, cell.center, cell.subThemeId, cell.themeId, neighborCells]);

  if (geometry.attributes.position === undefined || geometry.attributes.position.count < 2) {
    return null;
  }

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={color} linewidth={2} />
    </lineSegments>
  );
}

/* ================================================================== */
/*  StockMarker — small cylinder for a single stock                    */
/* ================================================================== */

function StockMarker({
  node,
  onClick
}: {
  node: StockRenderNode;
  onClick?: () => void;
}) {
  const height = Math.max(Math.abs(node.metric.height), MIN_COLUMN_HEIGHT);

  return (
    <group position={[node.position.x, 0.04, node.position.z]}>
      <mesh castShadow visible={node.visible} onClick={onClick}>
        <cylinderGeometry args={[STOCK_CYLINDER_RADIUS, STOCK_CYLINDER_RADIUS, height, STOCK_CYLINDER_SEGMENTS]} />
        <meshStandardMaterial
          color={node.metric.color}
          opacity={node.metric.intensity}
          transparent
          emissive={node.metric.color}
          emissiveIntensity={0.04}
        />
      </mesh>
    </group>
  );
}

/* ================================================================== */
/*  Label helpers                                                       */
/* ================================================================== */

/** Show label if SubTheme is in focus or there is no focus active. */
function shouldShowSubThemeLabel(
  subThemeId: string,
  focusSubThemeId?: string
): boolean {
  if (!focusSubThemeId) return true;
  return subThemeId === focusSubThemeId;
}

/** Show stock label only for top stocks or when in focus mode. */
function shouldShowStockLabel(
  subThemeId: string,
  rankInSubTheme: number,
  focusSubThemeId?: string
): boolean {
  if (focusSubThemeId && subThemeId === focusSubThemeId) return true;
  return rankInSubTheme < 3;
}

/* ================================================================== */
/*  Legacy TerrainPlane — kept for backward compatibility               */
/* ================================================================== */

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

/** Legacy label visibility — kept for backward compat tests. */
function legacyShouldShowLabel(node: RenderNode, focusSubThemeId?: string): boolean {
  if (node.sector.isThemeCenter) return true;
  if (node.isSubThemeCenter) return true;
  if (focusSubThemeId && node.sector.subThemeId === focusSubThemeId) return true;
  return false;
}

/* ================================================================== */
/*  Legacy CapitalMapSceneProps (Gen3)                                 */
/* ================================================================== */

export interface LegacyCapitalMapSceneProps {
  nodes: RenderNode[];
  cameraPreset: CameraPreset;
  selectedSectorId?: SectorId;
  focusSubThemeId?: string;
  onSelectSector: (sectorId: SectorId) => void;
  onFocusSubTheme?: (subThemeId: string | undefined) => void;
  orbitControlsRef?: RefObject<SceneOrbitControls | null>;
}

/* ================================================================== */
/*  Voronoi CapitalMapSceneProps (Gen4)                                */
/* ================================================================== */

export interface VoronoiCapitalMapSceneProps {
  voronoiLayout: VoronoiLayout;
  stockNodes: StockRenderNode[];
  cameraPreset: CameraPreset;
  selectedSectorId?: SectorId;
  focusSubThemeId?: string;
  onSelectSector: (sectorId: SectorId) => void;
  onFocusSubTheme: (subThemeId: string | undefined) => void;
  orbitControlsRef?: RefObject<SceneOrbitControls | null>;
}

/* ================================================================== */
/*  Union props — supports both Gen3 and Gen4                         */
/* ================================================================== */

export type CapitalMapSceneProps =
  | ({ mode?: "legacy" } & LegacyCapitalMapSceneProps)
  | ({ mode: "voronoi" } & VoronoiCapitalMapSceneProps);

/* ================================================================== */
/*  Legacy scene (Gen3 grid rendering)                                  */
/* ================================================================== */

function LegacyCapitalMapScene(props: LegacyCapitalMapSceneProps) {
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
        const showLabel = legacyShouldShowLabel(node, props.focusSubThemeId);
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

/* ================================================================== */
/*  Voronoi scene (Gen4)                                               */
/* ================================================================== */

function VoronoiCapitalMapScene(props: VoronoiCapitalMapSceneProps) {
  const { camera } = useThree();
  const { voronoiLayout, stockNodes, focusSubThemeId } = props;

  useEffect(() => {
    applyCameraPreset(camera, props.cameraPreset, props.orbitControlsRef?.current);
  }, [camera, props.cameraPreset, props.orbitControlsRef]);

  // Build a lookup from themeId → hex color from the theme registry
  const cellColorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const theme of themeList) {
      map.set(theme.id, theme.color);
    }
    return map;
  }, []);

  // Compute stock ranks per SubTheme (for label visibility)
  const stockRankBySubTheme = useMemo(() => {
    const rank = new Map<string, number>();
    for (const node of stockNodes) {
      const current = rank.get(node.subTheme.id) ?? 0;
      rank.set(node.subTheme.id, current + 1);
      // Store rank on node for later lookup (via index)
    }
    return rank;
  }, [stockNodes]);

  // Build a lookup from subThemeId → readable name
  const subThemeNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const st of subThemeList) {
      map.set(st.id, st.name);
    }
    return map;
  }, []);

  const borderLineColor = "#5a6a7a";

  // Stable click handler factory to prevent re-renders on every click
  const handlePlateClick = useCallback(
    (subThemeId: string) => {
      if (focusSubThemeId === subThemeId) {
        props.onFocusSubTheme(undefined);
      } else {
        props.onFocusSubTheme(subThemeId);
      }
    },
    [focusSubThemeId, props.onFocusSubTheme]
  );

  return (
    <group>
      {/* Voronoi base plates */}
      {voronoiLayout.cells.map((cell) => {
        const themeColor = cellColorMap.get(cell.themeId) ?? "#26313d";
        const isFocused =
          !focusSubThemeId || cell.subThemeId === focusSubThemeId;
        const opacity = isFocused ? 0.85 : 0.15;

        return (
          <VoronoiPlate
            key={cell.subThemeId}
            cell={cell}
            themeColor={themeColor}
            opacity={opacity}
            onClick={() => handlePlateClick(cell.subThemeId)}
          />
        );
      })}

      {/* Province border lines */}
      {voronoiLayout.cells.map((cell) => (
        <ProvinceBorderLine
          key={`border-${cell.subThemeId}`}
          cell={cell}
          neighborCells={voronoiLayout.cells}
          color={borderLineColor}
        />
      ))}

      {/* Stock markers */}
      {stockNodes.map((node, index) => {
        // Compute rank within subTheme
        let rankInSubTheme = 0;
        for (let i = 0; i < index; i++) {
          if (stockNodes[i].subTheme.id === node.subTheme.id) rankInSubTheme++;
        }
        const showStockLabel = shouldShowStockLabel(
          node.subTheme.id,
          rankInSubTheme,
          focusSubThemeId
        );

        return (
          <group key={node.stock.id}>
            <StockMarker
              node={node}
              onClick={() => props.onSelectSector(node.stock.subThemeId)}
            />
            {showStockLabel && (
              <Text
                position={[node.position.x, 0.5, node.position.z]}
                rotation={[-Math.PI / 2, 0, 0]}
                fontSize={0.12}
                color="#e8eef5"
                anchorX="center"
                anchorY="middle"
                maxWidth={0.8}
              >
                {node.stock.shortName}
              </Text>
            )}
          </group>
        );
      })}

      {/* SubTheme labels at cell centers */}
      {voronoiLayout.cells.map((cell) => {
        const showLabel = shouldShowSubThemeLabel(cell.subThemeId, focusSubThemeId);
        if (!showLabel) return null;

        return (
          <Text
            key={`label-${cell.subThemeId}`}
            position={[cell.center.x, 0.12, cell.center.z]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={0.18}
            color={focusSubThemeId === cell.subThemeId ? "#ffffff" : "#c0cad6"}
            anchorX="center"
            anchorY="middle"
            maxWidth={1.6}
          >
            {subThemeNameMap.get(cell.subThemeId) ?? cell.subThemeId}
          </Text>
        );
      })}
    </group>
  );
}

/* ================================================================== */
/*  Main exported component — dispatches to legacy or voronoi mode    */
/* ================================================================== */

export function CapitalMapScene(props: CapitalMapSceneProps) {
  if (props.mode === "voronoi") {
    return (
      <VoronoiCapitalMapScene
        voronoiLayout={props.voronoiLayout}
        stockNodes={props.stockNodes}
        cameraPreset={props.cameraPreset}
        selectedSectorId={props.selectedSectorId}
        focusSubThemeId={props.focusSubThemeId}
        onSelectSector={props.onSelectSector}
        onFocusSubTheme={props.onFocusSubTheme}
        orbitControlsRef={props.orbitControlsRef}
      />
    );
  }

  // Legacy mode — backward compat for existing consumers (App.tsx Gen3)
  return (
    <LegacyCapitalMapScene
      nodes={props.nodes}
      cameraPreset={props.cameraPreset}
      selectedSectorId={props.selectedSectorId}
      focusSubThemeId={props.focusSubThemeId}
      onSelectSector={props.onSelectSector}
      onFocusSubTheme={props.onFocusSubTheme}
      orbitControlsRef={props.orbitControlsRef}
    />
  );
}

/* ================================================================== */
/*  Utility                                                            */
/* ================================================================== */
