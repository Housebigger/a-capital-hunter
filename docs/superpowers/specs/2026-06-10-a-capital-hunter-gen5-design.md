# A Capital Hunter Gen5 Iteration Spec

Date: 2026-06-10

## Product Intent

Gen5 fixes two visual bugs from Gen4 that prevent the Voronoi map from looking correct:

1. SubTheme base plates render as black instead of inheriting their parent Theme's color.
2. SubTheme base plates appear as square shapes instead of the designed Voronoi polygons.

## Scope

Two targeted fixes in `src/components/CapitalMapScene.tsx`:

1. **Color inheritance**: Replace `hashStringToHue()` with actual theme colors from `themeRegistry.ts`. Each SubTheme cell inherits its parent Theme's hex color (e.g., `#e86152` for AI算力).

2. **Polygon orientation**: Add `rotation={[-Math.PI / 2, 0, 0]}` to the VoronoiPlate mesh so the extruded polygon lies flat on the XZ ground plane instead of standing vertically.

## Root Causes

### Issue 1: Black base plates
`hashStringToHue()` produces HSL strings like `hsl(120, 35%, 28%)`. Three.js `MeshStandardMaterial.color` does not parse HSL strings — it only accepts hex strings (e.g., `#ff0000`), `THREE.Color` objects, or CSS named colors. The material silently falls back to black.

### Issue 2: Square shapes
`ExtrudeGeometry` creates the 2D shape in the XY plane and extrudes along the Z axis. Without rotation:
- Shape x → world x ✓
- Shape y → world y (should be world z)
- Extrusion (local z) → world z (should be world y)

The polygon stands vertical. From the angled camera, it projects as a thin rectangle or appears degenerate.

## Design

### Color Fix
- Import `themes` from `../domain/themeRegistry`
- Build a `Map<ThemeId, string>` mapping theme IDs to their hex colors
- In `VoronoiCapitalMapScene`, look up color by `cell.themeId`

### Orientation Fix
- Add `rotation={[-Math.PI / 2, 0, 0]}` to the VoronoiPlate `<mesh>` element
- Adjust y-position to `0.04` (half of depth 0.08) so the plate sits on the ground

### Bonus: SubTheme label names
- Current code renders `{cell.subThemeId}` (raw ID like "ai-computing-infra")
- Should render the SubTheme's human-readable name
- Import `subThemes` from `../domain/subThemeRegistry` and build a lookup map

## Acceptance Criteria
- Voronoi base plates show theme colors (not black)
- Voronoi base plates are flat polygonal shapes on the ground
- SubTheme labels show readable names
- All existing tests pass
