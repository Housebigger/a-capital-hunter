# A Capital Hunter Second-Generation Layout Engine Design Spec

Date: 2026-06-08

## Product Intent

The second generation of A Capital Hunter focuses on upgrading the sector period table base map. The goal is not to become a full real-time A-share data platform yet. The goal is to prove that the base map can grow from a manually authored concept layout into an algorithm-controlled market cognition map.

The second generation should validate two upgrades:

- Expand the theme and sector universe from the first-generation 3-theme prototype to a medium-sized multi-theme map.
- Replace fixed manual coordinates with an explainable algorithmic layout engine that can generate stable grid positions from sector relationships and market-stage signals.

The 3D capital peak surface remains the core visual experience. The second-generation difference is that the two-dimensional base map beneath the peaks becomes an intelligent, extensible layer.

## Chosen Direction

The selected direction is a balanced second-generation prototype.

It should include both:

- An independently testable algorithmic layout core.
- A web demonstration that shows algorithm-generated layouts, market-stage layout versions, and per-sector layout explanations.

This avoids two weaker outcomes: an algorithm script that cannot be experienced as a product, or a visual demo where "algorithmic layout" is only a cosmetic label.

## Scope

The second generation includes:

- A medium-sized theme universe of 7 main themes and 40-60 sectors.
- A relationship model combining industrial-chain structure, market co-movement, and market-stage heat.
- A deterministic layout engine that outputs grid coordinates compatible with the existing `SectorLayout` shape.
- A hybrid layout method: continuous relationship layout first, then period-table grid snapping.
- Market-stage layout versions, generated only when the market regime meaningfully changes.
- Manual UI comparison between the current layout stage and the previous layout stage.
- A layout explanation section in the sector inspector.
- A stable local demo data track plus an experimental public-data adapter interface.

The second generation does not include:

- Full A-share market coverage.
- Real-time quote or fund-flow refresh.
- A complete market-data cleaning platform.
- User-authored custom sector editing.
- A full algorithm parameter tuning interface.
- Fully dynamic layout movement on every time slice.

## Theme And Sector Universe

The first-generation map contains AI computing power, robotics / physical AI, and low-altitude economy. The second generation expands toward a market-mainline balanced version.

Target themes:

| Theme | Role |
| --- | --- |
| AI computing power | Existing technology growth center |
| Robotics / physical AI | Existing embodied AI center |
| Low-altitude economy | Existing policy and application center |
| Semiconductors | Hard technology and supply-chain center |
| New energy | Energy transition and cyclical growth center |
| Defense / commercial aerospace | Policy, defense, and aerospace technology center |
| Innovative drugs / medicine | Non-technology growth and defensive-growth center |

The implementation should start with all seven target themes. The target sector count is 40-60. This size is large enough to reveal multi-center layout behavior and label-density issues, while still small enough for controlled design and testing.

Each sector should include:

- Stable id.
- Display name and short name.
- Aliases.
- Primary theme id.
- Related theme ids.
- Industrial-chain role.
- Theme-center flag.
- Relationship notes.
- Optional metadata for future public-data mapping.

## Relationship Model

The layout engine should not read fixed coordinates as the source of truth. It should read a relationship graph.

### Relationship Edges

A relationship edge connects two sectors or two theme-level concepts. Each edge has:

- Source sector id.
- Target sector id.
- Relationship type.
- Base weight.
- Optional stage modifier.
- Explanation text.

Relationship types:

| Type | Meaning |
| --- | --- |
| Industrial chain | Upstream, downstream, technical dependency, shared component, shared application scenario |
| Market co-movement | Historical resonance, same trading narrative, simultaneous fund attention |
| Heat correction | Current market-stage strength that lightly pulls a theme or sector toward the visual center |

The blended relationship weight should follow this principle:

> Industrial-chain structure forms the stable skeleton. Market co-movement and heat only modify the skeleton lightly.

This preserves user spatial memory while allowing the map to express rotation.

## Market Stages

The second generation does not re-layout the base map on every time slice. It introduces market-stage layout versions.

A `LayoutStage` should include:

- Stage id.
- Stage label.
- Stage story.
- Theme heat values.
- Sector heat or mock fund-flow values.
- Relationship modifiers.
- Previous-stage id when applicable.
- Layout version metadata.

Example stages:

| Stage | Story |
| --- | --- |
| AI / semiconductor resonance | AI computing power and semiconductor supply chain pull toward the center |
| Robotics / low-altitude diffusion | Physical AI and low-altitude application themes strengthen |
| New energy / defense rotation | Earlier technology peaks cool while new energy and defense / aerospace gain attention |

The UI should allow users to compare stage layouts manually. The map should not drift automatically during normal browsing.

## Algorithmic Layout Engine

The layout engine should be a pure domain module independent from React and Three.js.

### Inputs

- Themes.
- Sectors.
- Relationship edges.
- Layout stage.
- Layout options such as grid size, spacing, seed, maximum stage movement, and center-pull strength.

### Outputs

The engine returns an algorithmic layout result that can still feed the first-generation rendering pipeline:

- `SectorLayout` cells with `{ sectorId, x, z, role, relationshipStrength }`.
- Layout version metadata.
- Per-sector layout explanations.
- Optional previous-position references for visual comparison.

### Four-Step Algorithm

1. **Build relationship graph**
   - Sectors are nodes.
   - Relationship edges become weighted links.
   - Theme centers receive stronger anchoring weight.
   - Cross-theme sectors can become bridge nodes.

2. **Continuous relationship layout**
   - A deterministic force-style or constraint-style solver computes continuous positions.
   - Strong relationships pull nodes closer.
   - Weak or unrelated nodes keep distance.
   - Same-theme sectors form local clusters.
   - Hot themes move slightly toward the visual center.
   - The solver uses a fixed seed and deterministic iteration to avoid random drift.

3. **Period-table grid snapping**
   - Continuous positions are not rendered directly.
   - Nodes are assigned to integer grid cells.
   - Cell assignment avoids overlap.
   - Theme centers receive priority for stable cells.
   - Ordinary sectors fill nearby cells while preserving relative relationships.

4. **Generate layout explanations**
   - Each sector receives a short explanation payload.
   - The explanation lists the strongest reasons the sector is placed near its neighbors.
   - Core sectors should show up to three reasons. Ordinary sectors should have at least one.

### Engine Requirements

The engine must be:

- Deterministic: identical input produces identical output.
- Collision-free: no two sectors occupy the same grid cell.
- Explainable: every rendered sector has a reason payload.
- Bounded: market-stage heat can move sectors only within a controlled limit.
- Compatible: output can be consumed by the existing `buildRenderNodes` and 3D scene path with minimal adaptation.

## UI And Interaction Model

The second-generation UI keeps the 3D capital map as the main view, but adds controls that make algorithmic layout visible.

### Layout Mode

Users can switch between:

- Manual layout: the first-generation static coordinates.
- Algorithm layout: the second-generation generated coordinates.

This creates a clear before / after comparison and provides a fallback if the algorithm needs debugging.

### Stage Selection

Users can select a layout stage. Changing stage updates both:

- Capital peak data.
- Algorithm-generated base-map positions.

The position change should be light and staged, not a constant animation.

### Compare Previous Stage

Users can turn on a "compare previous stage" option. The UI may show:

- Ghost cells.
- Movement traces.
- Previous-position markers.

This makes rotation legible without making the map move by itself.

### Inspector Explanation

When a sector is selected, the inspector should include:

- Existing fund-flow and theme information.
- Primary layout reason.
- Up to three closest or strongest related sectors.
- Relationship source: industrial chain, market co-movement, or heat correction.
- Weight or strength label.
- Whether current stage heat affected placement.

The product should not expose a full algorithm tuning panel in this generation. Users should see why the map is arranged this way, not tune every solver parameter.

### Dataset Summary

The page should show lightweight metadata:

- Theme count.
- Sector count.
- Relationship edge count.
- Active layout version.
- Active stage.

This helps demonstrate that the base map has expanded beyond the first-generation 18-sector prototype.

## Data Strategy

The second generation uses a dual-track strategy.

### Stable Local Demo Data

The default product path uses local configuration:

- Theme and sector registry.
- Relationship edges.
- Market stages.
- Mock fund-flow values.

This path must be stable enough for demos and automated tests.

### Experimental Public-Data Adapter

The generation should define an experimental adapter interface for future public data. It may include a minimal sample implementation, but it should not be required for default app startup.

Adapter output should normalize:

- Sector fund-flow values.
- Theme heat.
- Sector heat.
- Market co-movement signal.
- Timestamp and source metadata.

If the public data source is unavailable, the app should continue to use stable local demo data.

## Architecture Fit With Version One

The first-generation app already has useful boundaries:

- `ThemeRegistry`
- `LayoutProvider`
- `ScenarioDataProvider`
- `MetricNormalizer`
- `buildRenderNodes`
- `HunterScene`
- `InspectorPanel`

The second-generation design should extend these boundaries instead of replacing the visualization stack.

Recommended additions:

- `relationshipRegistry`: static relationship edges and validation helpers.
- `layoutStages`: market-stage data and stage metadata.
- `algorithmicLayoutEngine`: pure deterministic layout module.
- `algorithmicLayoutProvider`: adapter that exposes generated layout through the existing provider shape.
- `layoutExplanations`: explanation structures keyed by sector id and stage id.
- UI state for layout mode, layout stage, and compare-previous-stage.

The 3D scene should continue receiving render nodes, not raw graph data.

## Testing And Acceptance Criteria

### Algorithm Tests

- Same input produces the same coordinates every run.
- Every sector receives exactly one grid cell.
- No two sectors share the same grid cell.
- Strong relationship pairs have lower average grid distance than weak or unrelated pairs.
- Hot themes move closer to the visual center in relevant stages.
- Stage movement stays within a configured maximum distance.
- Each sector receives at least one explanation.
- Theme centers receive richer explanations when relationships exist.

### Data Tests

- Sector count is within the target second-generation range.
- Every sector references a valid primary theme.
- Related theme ids are valid.
- Relationship edges reference valid sector ids.
- Relationship edge duplicates are rejected.
- Every layout stage includes theme heat and mock fund-flow data for renderable sectors.

### UI Tests

- Users can switch between manual and algorithm layouts.
- Users can switch market stages.
- Users can enable previous-stage comparison.
- Selecting a sector shows fund-flow details and layout explanation.
- Dataset summary shows theme count, sector count, edge count, layout version, and active stage.

### Visual Tests

- The 3D scene is nonblank on desktop.
- Multi-theme peaks remain distinguishable.
- The expanded sector count does not make labels completely unreadable.
- Mobile does not break layout, even though desktop remains the primary surface.
- Screenshot and pixel checks continue to verify scene rendering.

## Success Definition

The second-generation prototype is successful when a user can open the website and see an algorithm-generated multi-theme sector period table beneath the 3D capital peaks, switch between market-stage layout versions, and understand why important sectors are near each other.

The result should make the product feel like it has moved from a hand-arranged concept map to an explainable market cognition map.
