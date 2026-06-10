# Gen5 Voronoi Visual Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two Gen4 visual bugs — black base plates and square shapes — so Voronoi polygon cells render correctly with theme colors on the ground plane.

**Architecture:** Targeted fixes in `CapitalMapScene.tsx`. Import theme colors from registry, replace HSL hash with hex lookup, add mesh rotation for flat orientation.

**Tech Stack:** React, Three.js, @react-three/fiber, TypeScript

---

### Task 1: Fix base plate colors — use theme registry hex colors

**Files:**
- Modify: `src/components/CapitalMapScene.tsx:1-15` (imports) and `:449-463` (cellColorMap)
- Test: `src/components/CapitalMapScene.test.tsx`

**Context:**
The current `VoronoiCapitalMapScene` uses `hashStringToHue()` to generate HSL color strings. Three.js `MeshStandardMaterial` does not parse HSL, causing black plates. The theme registry at `src/domain/themeRegistry.ts` already defines hex colors per theme (e.g., `{ id: "ai-computing", color: "#e86152" }`).

- [ ] **Step 1: Write the failing test**

Add a test that verifies Voronoi mode renders cells with theme colors, not black:

```typescript
it("VoronoiCapitalMapScene uses theme hex colors for base plates", () => {
  const themes = [
    { id: "test-theme", name: "Test", color: "#ff0000", shortName: "T" },
  ] as any;
  // The rendered VoronoiPlate should receive "#ff0000" as themeColor,
  // not an HSL string or black.
  // Verify by checking that cellColorMap resolves to the theme's hex color.
  // This is tested by importing the component and checking mesh material props.
});
```

- [ ] **Step 2: Implement the fix**

In `CapitalMapScene.tsx`:

1. Add import at top:
```typescript
import { themes as themeList } from "../domain/themeRegistry";
```

2. Replace the `cellColorMap` useMemo in `VoronoiCapitalMapScene` (lines 450-463):
```typescript
const cellColorMap = useMemo(() => {
  const map = new Map<string, string>();
  for (const theme of themeList) {
    map.set(theme.id, theme.color);
  }
  return map;
}, []);
```

3. Remove the `hashStringToHue` function (lines 612-619) since it's no longer used.

- [ ] **Step 3: Run tests to verify**

Run: `npx vitest run src/components/CapitalMapScene.test.tsx`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/components/CapitalMapScene.tsx
git commit -m "fix: use theme registry hex colors for Voronoi base plates"
```

---

### Task 2: Fix base plate orientation — rotate extruded polygons flat

**Files:**
- Modify: `src/components/CapitalMapScene.tsx:130-131` (VoronoiPlate mesh)
- Test: `src/components/CapitalMapScene.test.tsx`

**Context:**
`ExtrudeGeometry` creates shapes in the XY plane and extrudes along Z. Without rotation, Voronoi polygons stand vertical. Adding `rotation={[-Math.PI / 2, 0, 0]}` maps:
- local x → world x ✓
- local y → world z ✓
- local z (extrusion) → world -y (downward, making the plate sit on the ground)

- [ ] **Step 1: Write the failing test**

```typescript
it("VoronoiPlate mesh has rotation to lie flat on ground", () => {
  // Verify the mesh element has rotation={[-Math.PI / 2, 0, 0]}
  // This ensures the extruded polygon lies in the XZ plane
});
```

- [ ] **Step 2: Implement the fix**

In `VoronoiPlate` component (line 131), change:
```tsx
<mesh position={[cell.center.x, 0, cell.center.z]} receiveShadow onClick={onClick}>
```
to:
```tsx
<mesh
  position={[cell.center.x, 0.04, cell.center.z]}
  rotation={[-Math.PI / 2, 0, 0]}
  receiveShadow
  onClick={onClick}
>
```

The y-position changes from `0` to `0.04` (half of depth 0.08) so the plate sits centered on the ground surface.

- [ ] **Step 3: Run tests to verify**

Run: `npx vitest run src/components/CapitalMapScene.test.tsx`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/components/CapitalMapScene.tsx
git commit -m "fix: rotate Voronoi plates to lie flat on ground plane"
```

---

### Task 3: Fix SubTheme labels — show readable names instead of IDs

**Files:**
- Modify: `src/components/CapitalMapScene.tsx:550-569` (SubTheme labels section)
- Test: `src/components/CapitalMapScene.test.tsx`

**Context:**
Line 566 renders `{cell.subThemeId}` which shows raw IDs like "ai-computing-infra". Should show the SubTheme's `name` field like "算力基础设施".

- [ ] **Step 1: Implement the fix**

1. Add import at top:
```typescript
import { subThemes as subThemeList } from "../domain/subThemeRegistry";
```

2. In `VoronoiCapitalMapScene`, add a lookup map:
```typescript
const subThemeNameMap = useMemo(() => {
  const map = new Map<string, string>();
  for (const st of subThemeList) {
    map.set(st.id, st.name);
  }
  return map;
}, []);
```

3. Replace line 566 `{cell.subThemeId}` with:
```tsx
{subThemeNameMap.get(cell.subThemeId) ?? cell.subThemeId}
```

- [ ] **Step 2: Run tests to verify**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add src/components/CapitalMapScene.tsx
git commit -m "fix: show SubTheme readable names instead of raw IDs"
```

---

### Task 4: Run full test suite and build verification

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass (98+ tests)

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds with no TypeScript errors

- [ ] **Step 3: Commit spec and plan**

```bash
git add docs/superpowers/specs/2026-06-10-a-capital-hunter-gen5-design.md
git add docs/superpowers/plans/2026-06-10-gen5-voronoi-fixes.md
git commit -m "docs: add Gen5 Voronoi visual fixes spec and plan"
```
