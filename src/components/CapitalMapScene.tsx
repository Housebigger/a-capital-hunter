import { Text } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";
import * as THREE from "three";
import { approach } from "../domain/layoutEasing";
import type { Point2D } from "../domain/polygonClip";
import { selectTopLabelsPerGroup, selectTopLabels } from "../domain/labelDensity";
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
import type { ThemeCell } from "../domain/themeVoronoiLayoutEngine";
import type { ThemeRenderNode } from "../domain/themeRenderNodes";
import type { SubThemeRenderNode } from "../domain/subThemeRenderNodes";
import type { StockRenderNode3 } from "../domain/stockRenderNodes";

/* ================================================================== */
/*  Label-density helpers                                              */
/* ================================================================== */

function subThemeWeightsForCells(
  cells: ReadonlyArray<{ subThemeId: string }>,
  stockNodes: ReadonlyArray<StockRenderNode3>
): { id: string; weight: number }[] {
  const weight = new Map<string, number>();
  for (const n of stockNodes) {
    weight.set(n.subTheme.id, Math.max(weight.get(n.subTheme.id) ?? 0, Math.abs(n.metric.height)));
  }
  return cells.map((c) => ({ id: c.subThemeId, weight: weight.get(c.subThemeId) ?? 0 }));
}

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
export const THEME_PLATE_THICKNESS = 0.12;
export const THEME_COLUMN_SEGMENTS = 12;
const THEME_COLUMN_RADIUS = 0.5;
const SUBTHEME_COLUMN_RADIUS = 0.25;
const SUBTHEME_COLUMN_SEGMENTS = 10;
const P3_STOCK_COLUMN_RADIUS = 0.10;
const P3_STOCK_COLUMN_SEGMENTS = 8;

/**
 * Approximate settle time (s) for layout/height easing. ~0.6s reads as a smooth
 * glide without feeling sluggish. Tune here if the in-browser feel is off.
 */
const EASE_TAU = 0.6;

/* ================================================================== */
/*  Camera & types                                                     */
/* ================================================================== */

export const cameraPositions: Record<CameraPreset, [number, number, number]> = {
  angled: [15, 15, 19],
  top: [0, 26, 0.1],
  side: [22, 9, 0]
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
/*  Animated helpers (SP2 Task 6 — heat-driven dynamic layout)          */
/*                                                                      */
/*  These ease positions / column heights toward their targets over     */
/*  ~EASE_TAU seconds (frame-rate independent) so cells and columns      */
/*  glide instead of snapping when the data window / heat changes.       */
/*  Polygon SHAPE still recomputes (snaps); only positions and heights   */
/*  ease — that is the intended SP2 behavior.                            */
/* ================================================================== */

/**
 * Eases a mesh's x/z position toward (targetX, targetZ). Used for plates so
 * the cell glides to its new centroid while its polygon shape snaps.
 *
 * IMPORTANT: x/z are owned imperatively (init effect + useFrame) and must NOT
 * be bound declaratively on the mesh (only `position-y` is), otherwise R3F
 * would re-apply the target on every prop-change render and defeat the ease.
 */
function useEasedXZ(
  targetX: number,
  targetZ: number
): RefObject<THREE.Mesh | null> {
  const ref = useRef<THREE.Mesh | null>(null);
  // Initialize at the target on first mount so it never eases in from origin.
  useEffect(() => {
    const m = ref.current;
    if (m) {
      m.position.x = targetX;
      m.position.z = targetZ;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useFrame((_, dt) => {
    const m = ref.current;
    if (!m) return;
    m.position.x = approach(m.position.x, targetX, dt, EASE_TAU);
    m.position.z = approach(m.position.z, targetZ, dt, EASE_TAU);
  });
  return ref;
}

/**
 * A capital column whose base is anchored to the plate surface and whose
 * x/z position and height ease toward their targets.
 *
 * Geometry is a unit-height cylinder translated so its BASE sits at the group
 * origin (local y=0). A positive y-scale (= height) grows the column away from
 * the base without lifting it. Outflow columns hang downward via a π rotation
 * of the group about X (a real rotation, so face winding / normals stay correct
 * — using a negative scale here would invert normals and render the column
 * hollow). x/z position and height (scale.y) are eased every frame; the
 * up/down orientation snaps on the rare inflow↔outflow flip.
 */
function AnimatedColumnMesh({
  targetX,
  targetZ,
  baseY,
  height,
  flip,
  radius,
  segments,
  color,
  opacity,
  emissiveIntensity,
  castShadow = true,
}: {
  targetX: number;
  targetZ: number;
  baseY: number;
  height: number;
  flip: boolean;
  radius: number;
  segments: number;
  color: string;
  opacity: number;
  emissiveIntensity: number;
  castShadow?: boolean;
}) {
  const groupRef = useRef<THREE.Group | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);

  // Unit cylinder (height 1) translated so its base is at local y=0.
  const geometry = useMemo(() => {
    const geo = new THREE.CylinderGeometry(radius, radius, 1, segments);
    geo.translate(0, 0.5, 0);
    return geo;
  }, [radius, segments]);

  useEffect(() => {
    return () => geometry.dispose();
  }, [geometry]);

  // Initialize on first mount so we don't ease in from the origin / zero height.
  // x/z and scale.y are owned imperatively from here on (see useFrame); they
  // must NOT be bound declaratively or R3F would snap them on every re-render.
  useEffect(() => {
    const g = groupRef.current;
    const m = meshRef.current;
    if (g) {
      g.position.x = targetX;
      g.position.z = targetZ;
    }
    if (m) {
      m.scale.y = height;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((_, dt) => {
    const g = groupRef.current;
    const m = meshRef.current;
    if (g) {
      g.position.x = approach(g.position.x, targetX, dt, EASE_TAU);
      g.position.z = approach(g.position.z, targetZ, dt, EASE_TAU);
    }
    if (m) {
      m.scale.y = approach(m.scale.y, height, dt, EASE_TAU);
    }
  });

  return (
    <group ref={groupRef} position-y={baseY} rotation-x={flip ? Math.PI : 0}>
      <mesh ref={meshRef} geometry={geometry} castShadow={castShadow} scale-x={1} scale-z={1}>
        <meshStandardMaterial
          color={color}
          opacity={opacity}
          transparent
          emissive={color}
          emissiveIntensity={emissiveIntensity}
          roughness={0.4}
        />
      </mesh>
    </group>
  );
}

/* ================================================================== */
/*  SelectedRing — gold highlight loop on the selected cell             */
/* ================================================================== */

const SELECT_RING_COLOR = "#ffd54a";
const SELECT_RING_TAU = 0.2;

/** A gold line-loop just above a cell's polygon, fading in over ~0.2s. */
function SelectedRing({ polygon, y }: { polygon: ReadonlyArray<Point2D>; y: number }) {
  const matRef = useRef<THREE.LineBasicMaterial | null>(null);
  const geometry = useMemo(() => {
    const pts: number[] = [];
    for (const p of polygon) pts.push(p.x, y, p.z);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, [polygon, y]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame((_, dt) => {
    const m = matRef.current;
    if (m) m.opacity = approach(m.opacity, 1, dt, SELECT_RING_TAU);
  });
  if (polygon.length < 3) return null;
  return (
    <lineLoop geometry={geometry}>
      <lineBasicMaterial ref={matRef} color={SELECT_RING_COLOR} transparent opacity={0} />
    </lineLoop>
  );
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
/*  CityBorderLine — thin lines between same-theme SubTheme cells      */
/* ================================================================== */

function CityBorderLine({
  cell,
  neighborCells
}: {
  cell: VoronoiCell;
  neighborCells: ReadonlyArray<VoronoiCell>;
}) {
  const geometry = useMemo(() => {
    const poly = cell.polygon;
    if (poly.length < 3) {
      return new THREE.BufferGeometry();
    }

    const points: THREE.Vector3[] = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const mx = (a.x + b.x) / 2;
      const mz = (a.z + b.z) / 2;

      // Find the nearest neighbor center to the edge midpoint
      let sameThemeNeighbor = false;
      let minDist = Infinity;
      for (const nb of neighborCells) {
        if (nb.subThemeId === cell.subThemeId) continue;
        const dx = mx - nb.center.x;
        const dz = mz - nb.center.z;
        const dist = dx * dx + dz * dz;
        if (dist < minDist) {
          minDist = dist;
          sameThemeNeighbor = nb.themeId === cell.themeId;
        }
      }

      // Only draw lines between same-theme SubTheme cells
      if (sameThemeNeighbor) {
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
      <lineBasicMaterial color="#ffffff" linewidth={1} transparent opacity={0.15} />
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
  const rawHeight = Math.abs(node.metric.height);
  const height = Math.max(rawHeight, MIN_COLUMN_HEIGHT);
  const isInflow = node.metric.direction === "inflow";
  const isOutflow = node.metric.direction === "outflow";

  // Base plate top surface at y=0.08, bottom at y=0
  // Inflow: column rises above the base plate top
  // Outflow: column hangs below the base plate bottom
  const baseY = isInflow ? 0.08 : isOutflow ? 0.00 : 0.04;
  const positionY = isInflow ? baseY + height / 2 : isOutflow ? baseY - height / 2 : baseY;

  return (
    <group position={[node.position.x, positionY, node.position.z]}>
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

      {/* Province border lines (cross-theme) */}
      {voronoiLayout.cells.map((cell) => (
        <ProvinceBorderLine
          key={`border-${cell.subThemeId}`}
          cell={cell}
          neighborCells={voronoiLayout.cells}
          color={borderLineColor}
        />
      ))}

      {/* City border lines (within same theme) */}
      {voronoiLayout.cells.map((cell) => (
        <CityBorderLine
          key={`city-${cell.subThemeId}`}
          cell={cell}
          neighborCells={voronoiLayout.cells}
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
/*  SubTheme-level scene (P2: ~30 Voronoi cells + columns)             */
/* ================================================================== */

export interface SubThemeCapitalMapSceneProps {
  themeCells: ReadonlyArray<ThemeCell>;
  voronoiCells: ReadonlyArray<VoronoiCell>;
  subThemeNodes: SubThemeRenderNode[];
  cameraPreset: CameraPreset;
  selectedSectorId?: SectorId;
  onSelectSector: (sectorId: SectorId) => void;
  orbitControlsRef?: RefObject<SceneOrbitControls | null>;
  compact?: boolean;
}

/* ================================================================== */
/*  P3 Stock-level scene props                                         */
/* ================================================================== */

export interface P3CapitalMapSceneProps {
  themeCells: ReadonlyArray<ThemeCell>;
  voronoiCells: ReadonlyArray<VoronoiCell>;
  stockNodes: StockRenderNode3[];
  cameraPreset: CameraPreset;
  selectedSectorId?: SectorId;
  onSelectSector: (sectorId: SectorId) => void;
  orbitControlsRef?: RefObject<SceneOrbitControls | null>;
  compact?: boolean;
}

/** Golden SubTheme boundary lines with 5-second breathing/pulsing opacity. */
function SubThemeBoundaryLines({
  voronoiCells,
  themeCells,
}: {
  voronoiCells: ReadonlyArray<VoronoiCell>;
  themeCells: ReadonlyArray<ThemeCell>;
}) {
  const lineY = THEME_PLATE_THICKNESS + 0.01;
  const materialRef = useRef<THREE.LineBasicMaterial>(null);

  // Breathing: 5-second cycle, opacity oscillates between 0.3 and 0.9
  useFrame(({ clock }) => {
    if (materialRef.current) {
      const t = clock.getElapsedTime();
      materialRef.current.opacity = 0.6 + 0.3 * Math.sin((2 * Math.PI * t) / 5);
    }
  });

  const geometry = useMemo(() => {
    const points: THREE.Vector3[] = [];

    for (const cell of voronoiCells) {
      const poly = cell.polygon;
      if (poly.length < 3) continue;

      for (let i = 0; i < poly.length; i++) {
        const a = poly[i];
        const b = poly[(i + 1) % poly.length];
        const mx = (a.x + b.x) / 2;
        const mz = (a.z + b.z) / 2;

        let minDistSameTheme = Infinity;
        for (const nb of voronoiCells) {
          if (nb.subThemeId === cell.subThemeId) continue;
          if (nb.themeId !== cell.themeId) continue;
          const dx = mx - nb.center.x;
          const dz = mz - nb.center.z;
          const dist = dx * dx + dz * dz;
          if (dist < minDistSameTheme) {
            minDistSameTheme = dist;
          }
        }

        let minDistOtherTheme = Infinity;
        for (const nb of voronoiCells) {
          if (nb.subThemeId === cell.subThemeId) continue;
          if (nb.themeId === cell.themeId) continue;
          const dx = mx - nb.center.x;
          const dz = mz - nb.center.z;
          const dist = dx * dx + dz * dz;
          if (dist < minDistOtherTheme) {
            minDistOtherTheme = dist;
          }
        }

        if (minDistSameTheme < minDistOtherTheme) {
          points.push(
            new THREE.Vector3(a.x, lineY, a.z),
            new THREE.Vector3(b.x, lineY, b.z)
          );
        }
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
  }, [voronoiCells, themeCells, lineY]);

  if (geometry.attributes.position === undefined || geometry.attributes.position.count < 2) {
    return null;
  }

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial
        ref={materialRef}
        color="#ffd700"
        transparent
        opacity={0.6}
      />
    </lineSegments>
  );
}

/**
 * Cylindrical column for SubTheme, centered on cell centroid. Its x/z position
 * and height ease toward their targets when the heat / data window changes.
 */
function SubThemeCylinderColumn({
  node,
  selected = false,
}: {
  node: SubThemeRenderNode;
  selected?: boolean;
}) {
  const { metric, position } = node;
  const rawHeight = Math.max(Math.abs(metric.height), 0.12);
  const isOutflow = metric.direction === "outflow";

  // Base anchored to the plate surface; height grows up (inflow/flat) or down
  // (outflow, via the column's π rotation) from that base.
  const baseY = isOutflow ? 0 : THEME_PLATE_THICKNESS;
  const columnOpacity = isOutflow ? 0.9 : 0.7;

  return (
    <AnimatedColumnMesh
      targetX={position.x}
      targetZ={position.z}
      baseY={baseY}
      height={rawHeight}
      flip={isOutflow}
      radius={SUBTHEME_COLUMN_RADIUS}
      segments={SUBTHEME_COLUMN_SEGMENTS}
      color={metric.color}
      opacity={columnOpacity}
      emissiveIntensity={selected ? 0.35 : 0.08}
    />
  );
}

/** Cylindrical column for individual stock (P3), smaller than SubTheme column. */
function P3StockColumn({ node }: { node: StockRenderNode3 }) {
  const { metric, position } = node;
  const rawHeight = Math.max(Math.abs(metric.height), MIN_COLUMN_HEIGHT);
  const isInflow = metric.direction === "inflow";
  const isOutflow = metric.direction === "outflow";

  const baseY = isInflow ? THEME_PLATE_THICKNESS : isOutflow ? 0 : THEME_PLATE_THICKNESS / 2;
  const positionY = isInflow ? baseY + rawHeight / 2 : isOutflow ? baseY - rawHeight / 2 : baseY;
  const columnOpacity = isOutflow ? 0.9 : 0.75;

  return (
    <mesh position={[position.x, positionY, position.z]} castShadow>
      <cylinderGeometry args={[P3_STOCK_COLUMN_RADIUS, P3_STOCK_COLUMN_RADIUS, rawHeight, P3_STOCK_COLUMN_SEGMENTS]} />
      <meshStandardMaterial
        color={metric.color}
        opacity={columnOpacity}
        transparent
        emissive={metric.color}
        emissiveIntensity={0.06}
        roughness={0.4}
      />
    </mesh>
  );
}

function SubThemeCapitalMapScene(props: SubThemeCapitalMapSceneProps) {
  const { camera } = useThree();
  const { themeCells, voronoiCells, subThemeNodes } = props;

  useEffect(() => {
    applyCameraPreset(camera, props.cameraPreset, props.orbitControlsRef?.current);
  }, [camera, props.cameraPreset, props.orbitControlsRef]);

  return (
    <group>
      {/* Layer 1: Theme base plates (reuse P1 logic) */}
      {themeCells.map((cell, i) => {
        const theme = themeList[i];
        if (!theme) return null;
        return (
          <ThemePlate key={`p2-plate-${theme.id}`} cell={cell} themeColor={theme.color} />
        );
      })}

      {/* Layer 2: Theme border outlines */}
      {themeCells.map((cell, i) => {
        const poly = cell.polygon;
        if (poly.length < 3) return null;
        const y = THEME_PLATE_THICKNESS + 0.01;
        const positions: number[] = [];
        for (let j = 0; j < poly.length; j++) {
          const a = poly[j];
          const b = poly[(j + 1) % poly.length];
          positions.push(a.x, y, a.z, b.x, y, b.z);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
        return (
          <lineSegments key={`p2-outline-${i}`} geometry={geo}>
            <lineBasicMaterial color={themeList[i].color} transparent opacity={0.6} />
          </lineSegments>
        );
      })}

      {/* Layer 3: SubTheme boundary lines */}
      <SubThemeBoundaryLines voronoiCells={voronoiCells} themeCells={themeCells} />

      {/* Selected sub-theme highlight ring */}
      {props.selectedSectorId && voronoiCells
        .filter((c) => c.subThemeId === props.selectedSectorId)
        .map((c) => <SelectedRing key={`sel-${c.subThemeId}`} polygon={c.polygon} y={THEME_PLATE_THICKNESS + 0.03} />)}

      {/* Layer 4: Cylindrical columns */}
      {subThemeNodes.map((node) => (
        <SubThemeCylinderColumn
          key={`p2-col-${node.subTheme.id}`}
          node={node}
          selected={node.subTheme.id === props.selectedSectorId}
        />
      ))}

      {/* Layer 5: SubTheme labels */}
      {(() => {
        const allowed = props.compact
          ? selectTopLabels(
              subThemeNodes.map((n) => ({ id: n.subTheme.id, weight: Math.abs(n.metric.height) })),
              10
            )
          : null;
        return subThemeNodes
          .filter((node) => allowed === null || allowed.has(node.subTheme.id))
          .map((node) => (
            <Text
              key={`p2-label-${node.subTheme.id}`}
              position={[node.position.x, THEME_PLATE_THICKNESS + 0.02, node.position.z]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.18}
              color="#ffffff"
              anchorX="center"
              anchorY="middle"
              maxWidth={1.6}
              outlineWidth={0.02}
              outlineColor="#000000"
            >
              {node.subTheme.shortName}
            </Text>
          ));
      })()}
    </group>
  );
}

/* ================================================================== */
/*  P3 Stock-level scene (individual stock cylinders within SubTheme   */
/*  Voronoi cells)                                                     */
/* ================================================================== */

function P3CapitalMapScene(props: P3CapitalMapSceneProps) {
  const { camera } = useThree();
  const { themeCells, voronoiCells, stockNodes } = props;

  useEffect(() => {
    applyCameraPreset(camera, props.cameraPreset, props.orbitControlsRef?.current);
  }, [camera, props.cameraPreset, props.orbitControlsRef]);

  // Build SubTheme name lookup for labels
  const subThemeNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const st of subThemeList) {
      map.set(st.id, st.shortName);
    }
    return map;
  }, []);

  return (
    <group>
      {/* Layer 1: Theme base plates */}
      {themeCells.map((cell, i) => {
        const theme = themeList[i];
        if (!theme) return null;
        return (
          <ThemePlate key={`p3-plate-${theme.id}`} cell={cell} themeColor={theme.color} />
        );
      })}

      {/* Layer 2: Theme border outlines */}
      {themeCells.map((cell, i) => {
        const poly = cell.polygon;
        if (poly.length < 3) return null;
        const y = THEME_PLATE_THICKNESS + 0.01;
        const positions: number[] = [];
        for (let j = 0; j < poly.length; j++) {
          const a = poly[j];
          const b = poly[(j + 1) % poly.length];
          positions.push(a.x, y, a.z, b.x, y, b.z);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
        return (
          <lineSegments key={`p3-outline-${i}`} geometry={geo}>
            <lineBasicMaterial color={themeList[i].color} transparent opacity={0.6} />
          </lineSegments>
        );
      })}

      {/* Layer 3: SubTheme boundary lines (golden) */}
      <SubThemeBoundaryLines voronoiCells={voronoiCells} themeCells={themeCells} />

      {/* Selected sub-theme highlight ring */}
      {props.selectedSectorId && voronoiCells
        .filter((c) => c.subThemeId === props.selectedSectorId)
        .map((c) => <SelectedRing key={`sel-${c.subThemeId}`} polygon={c.polygon} y={THEME_PLATE_THICKNESS + 0.03} />)}

      {/* Layer 4: Individual stock columns */}
      {stockNodes.filter(n => n.visible).map((node) => (
        <P3StockColumn key={`p3-col-${node.stock.id}`} node={node} />
      ))}

      {/* Layer 5: Stock labels (show shortName for top stocks per SubTheme) */}
      {(() => {
        const visible = stockNodes.filter((n) => n.visible);
        const perGroup = props.compact ? 1 : 3;
        const labeledIds = selectTopLabelsPerGroup(
          visible.map((n) => ({ id: n.stock.id, subThemeId: n.subTheme.id, weight: Math.abs(n.metric.height) })),
          perGroup
        );
        return visible
          .filter((node) => labeledIds.has(node.stock.id))
          .map((node) => (
            <Text
              key={`p3-label-${node.stock.id}`}
              position={[node.position.x, THEME_PLATE_THICKNESS + Math.abs(node.metric.height) + 0.08, node.position.z]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.12}
              color="#f3f6fa"
              outlineWidth={0.012}
              outlineColor="#0b0f14"
              anchorX="center"
              anchorY="middle"
              maxWidth={0.9}
            >
              {node.stock.shortName}
            </Text>
          ));
      })()}

      {/* Layer 6: SubTheme name labels at cell centers */}
      {(() => {
        const allowed = props.compact
          ? selectTopLabels(subThemeWeightsForCells(voronoiCells, stockNodes), 10)
          : null; // null = show all (desktop, unchanged)
        return voronoiCells
          .filter((cell) => allowed === null || allowed.has(cell.subThemeId))
          .map((cell) => (
            <Text
              key={`p3-sublabel-${cell.subThemeId}`}
              position={[cell.center.x, THEME_PLATE_THICKNESS + 0.02, cell.center.z]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.13}
              color="#b0bec5"
              anchorX="center"
              anchorY="middle"
              maxWidth={1.2}
              outlineWidth={0.01}
              outlineColor="#000000"
            >
              {subThemeNameMap.get(cell.subThemeId) ?? cell.subThemeId}
            </Text>
          ));
      })()}
    </group>
  );
}

/* ================================================================== */
/*  Theme-level scene (P1: 11 big plates + 11 thick columns)           */
/* ================================================================== */

export interface ThemeCapitalMapSceneProps {
  themeCells: ReadonlyArray<ThemeCell>;
  themeNodes: ThemeRenderNode[];
  cameraPreset: CameraPreset;
  selectedSectorId?: SectorId;
  onSelectSector: (sectorId: SectorId) => void;
  orbitControlsRef?: RefObject<SceneOrbitControls | null>;
  compact?: boolean;
}


function ThemePlate({
  cell,
  themeColor,
  onClick,
}: {
  cell: ThemeCell;
  themeColor: string;
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
  }, [cell.polygon, cell.center]);

  const meshRef = useEasedXZ(cell.center.x, cell.center.z);

  if (!shape) return null;

  return (
    <mesh
      ref={meshRef}
      position-y={THEME_PLATE_THICKNESS / 2}
      rotation={[Math.PI / 2, 0, 0]}
      receiveShadow
      onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined}
    >
      <extrudeGeometry args={[shape, { depth: THEME_PLATE_THICKNESS, bevelEnabled: false }]} />
      <meshStandardMaterial
        color={themeColor}
        opacity={0.32}
        transparent
        roughness={0.7}
      />
    </mesh>
  );
}

function ThemeCapitalMapScene(props: ThemeCapitalMapSceneProps) {
  const { camera } = useThree();
  const { themeCells, themeNodes } = props;

  useEffect(() => {
    applyCameraPreset(camera, props.cameraPreset, props.orbitControlsRef?.current);
  }, [camera, props.cameraPreset, props.orbitControlsRef]);

  return (
    <group>
      {/* Theme base plates */}
      {themeCells.map((cell, i) => {
        const theme = themeList[i];
        return (
          <ThemePlate
            key={theme.id}
            cell={cell}
            themeColor={theme.color}
            onClick={() => props.onSelectSector(theme.id)}
          />
        );
      })}

      {/* Theme border outlines */}
      {themeCells.map((cell, i) => {
        const poly = cell.polygon;
        if (poly.length < 3) return null;

        const y = THEME_PLATE_THICKNESS + 0.01;
        // Build line segments: each edge as a pair of points
        const positions: number[] = [];
        for (let j = 0; j < poly.length; j++) {
          const a = poly[j];
          const b = poly[(j + 1) % poly.length];
          positions.push(a.x, y, a.z, b.x, y, b.z);
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(positions, 3)
        );

        return (
          <lineSegments key={`outline-${i}`} geometry={geo}>
            <lineBasicMaterial color={themeList[i].color} transparent opacity={0.6} />
          </lineSegments>
        );
      })}

      {/* Selected theme highlight ring */}
      {props.selectedSectorId && themeCells
        .map((cell, i) => ({ cell, id: themeList[i]?.id }))
        .filter((x) => x.id === props.selectedSectorId)
        .map((x) => <SelectedRing key={`sel-theme-${x.id}`} polygon={x.cell.polygon} y={THEME_PLATE_THICKNESS + 0.03} />)}

      {/* Capital columns */}
      {themeNodes.map((node) => {
        const rawHeight = Math.max(Math.abs(node.metric.height), 0.15);
        const isOutflow = node.metric.direction === "outflow";
        // Base anchored to the plate surface; height grows up (inflow/flat) or
        // down (outflow, via the column's π rotation) from that base.
        const baseY = isOutflow ? 0 : THEME_PLATE_THICKNESS;
        const columnOpacity = isOutflow ? 0.9 : 0.7;

        return (
          <group key={`col-${node.theme.id}`}>
            <AnimatedColumnMesh
              targetX={node.position.x}
              targetZ={node.position.z}
              baseY={baseY}
              height={rawHeight}
              flip={isOutflow}
              radius={THEME_COLUMN_RADIUS}
              segments={THEME_COLUMN_SEGMENTS}
              color={node.metric.color}
              opacity={columnOpacity}
              emissiveIntensity={props.selectedSectorId === node.theme.id ? 0.35 : 0.08}
            />
            {/* Theme label */}
            <Text
              position={[node.position.x, THEME_PLATE_THICKNESS + 0.02, node.position.z]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.35}
              color="#ffffff"
              anchorX="center"
              anchorY="middle"
              maxWidth={2}
              outlineWidth={0.03}
              outlineColor="#000000"
            >
              {node.theme.shortName}
            </Text>
          </group>
        );
      })}
    </group>
  );
}

/* ================================================================== */
/*  Main exported component — dispatches to mode                        */
/* ================================================================== */

export type CapitalMapSceneProps =
  | ({ mode?: "legacy" } & LegacyCapitalMapSceneProps)
  | ({ mode: "voronoi" } & VoronoiCapitalMapSceneProps)
  | ({ mode: "theme" } & ThemeCapitalMapSceneProps)
  | ({ mode: "subtheme" } & SubThemeCapitalMapSceneProps)
  | ({ mode: "stock" } & P3CapitalMapSceneProps);

export function CapitalMapScene(props: CapitalMapSceneProps) {
  if (props.mode === "stock") {
    return (
      <P3CapitalMapScene
        themeCells={(props as P3CapitalMapSceneProps).themeCells}
        voronoiCells={(props as P3CapitalMapSceneProps).voronoiCells}
        stockNodes={(props as P3CapitalMapSceneProps).stockNodes}
        cameraPreset={props.cameraPreset}
        selectedSectorId={(props as P3CapitalMapSceneProps).selectedSectorId}
        onSelectSector={props.onSelectSector}
        orbitControlsRef={props.orbitControlsRef}
        compact={(props as P3CapitalMapSceneProps).compact}
      />
    );
  }

  if (props.mode === "subtheme") {
    return (
      <SubThemeCapitalMapScene
        themeCells={(props as SubThemeCapitalMapSceneProps).themeCells}
        voronoiCells={(props as SubThemeCapitalMapSceneProps).voronoiCells}
        subThemeNodes={(props as SubThemeCapitalMapSceneProps).subThemeNodes}
        cameraPreset={props.cameraPreset}
        selectedSectorId={(props as SubThemeCapitalMapSceneProps).selectedSectorId}
        onSelectSector={props.onSelectSector}
        orbitControlsRef={props.orbitControlsRef}
        compact={(props as SubThemeCapitalMapSceneProps).compact}
      />
    );
  }

  if (props.mode === "theme") {
    return (
      <ThemeCapitalMapScene
        themeCells={(props as ThemeCapitalMapSceneProps).themeCells}
        themeNodes={(props as ThemeCapitalMapSceneProps).themeNodes}
        cameraPreset={props.cameraPreset}
        selectedSectorId={(props as ThemeCapitalMapSceneProps).selectedSectorId}
        onSelectSector={props.onSelectSector}
        orbitControlsRef={props.orbitControlsRef}
        compact={(props as ThemeCapitalMapSceneProps).compact}
      />
    );
  }

  if (props.mode === "voronoi") {
    return (
      <VoronoiCapitalMapScene
        voronoiLayout={(props as VoronoiCapitalMapSceneProps).voronoiLayout}
        stockNodes={(props as VoronoiCapitalMapSceneProps).stockNodes}
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
      nodes={(props as LegacyCapitalMapSceneProps).nodes}
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
