# A Capital Hunter Design Spec

Date: 2026-06-08

## Product Intent

A Capital Hunter is a desktop-first web prototype for visualizing A-share market theme rotation through a 3D capital terrain. The first version is a demonstrable concept prototype, not a complete market data product. Its core purpose is to prove that a relationship-aware sector map can make capital movement easier to understand than ordinary tables or heatmaps.

The first version prioritizes the base map logic. The 3D view should make that logic visible: two-dimensional position expresses sector relationships, column height expresses capital strength, color expresses inflow or outflow, and manual time switching expresses rotation.

## First-Version Scope

The prototype will be a configuration-driven 3D concept demo. It will use hand-authored layout configuration and controlled mock market scenarios, while keeping clear interfaces for future algorithmic layout and real data ingestion.

The first version includes:

- A desktop large-screen web experience.
- A relationship-aware sector period table as the 2D base map.
- Three major theme centers:
  - AI computing power
  - Robotics / physical AI
  - Low-altitude economy
- Four to five related sectors around each theme center.
- Discrete 3D capital columns above sector cells.
- Manual time-slice switching to demonstrate rotation.
- Camera controls, preset views, zoom, pan, and state filters.
- Minimal hover or selection information for each sector.

The first version does not include:

- Full A-share market coverage.
- Live production data ingestion.
- Automated algorithmic layout.
- Mobile-first interaction design.
- Dense research dashboard metrics.
- Continuous terrain interpolation between sectors.

## Core Product Hypothesis

The first version should validate this hypothesis:

> A market cognition map organized around capital-recognized theme centers can make A-share theme rotation easier to see, explain, and remember when combined with 3D column height and time-slice interaction.

The base map is not a decorative grid. It is the product's main conceptual asset. The 3D columns derive their meaning from the map beneath them.

## Base Map Logic

The sector period table uses a multi-center main-theme chain layout.

Each hot theme has a local center. The strongest theme sector sits at the center of its local cluster, while upstream, downstream, extension, and historically resonant sectors are placed nearby. The closer two cells are, the stronger their relationship should feel in market cognition.

The layout is manually configured in version one to keep the concept stable and explainable. The same output shape must later support algorithm-generated coordinates.

### Initial Theme Centers

The first version contains three theme centers:

| Theme | Role |
| --- | --- |
| AI computing power | One primary peak cluster |
| Robotics / physical AI | One primary peak cluster |
| Low-altitude economy | One primary peak cluster |

### Initial Related Sectors

Candidate sectors for the first prototype:

| Theme | Related sectors |
| --- | --- |
| AI computing power | Optical modules, CPO, liquid-cooled servers, domestic computing, data centers |
| Robotics / physical AI | Reducers, servo systems, sensors, machine vision, actuators |
| Low-altitude economy | eVTOL, flight-control systems, drones, general aviation operations, air-traffic systems |

Some sectors may belong to multiple themes through metadata, but each sector has one primary visual position in the first version. This prevents the base map from becoming visually noisy while preserving future cross-theme modeling.

## 3D Capital View

The first prototype uses discrete columns rather than a continuous terrain surface.

Each sector cell has one corresponding 3D column:

- Positive capital value: column extends upward.
- Negative capital value: column extends downward.
- Near-zero value: column stays close to the base map.

The first version keeps the visual grammar simple:

- Red means capital inflow.
- Green means capital outflow.
- Neutral gray or dimmed styling means flat, weak, or filtered state.
- Stronger values may use stronger opacity, saturation, or height.

The 3D scene should make three possible peaks visible at once. During time-slice switching, different theme clusters rise or fall, making rotation legible.

## Interaction Model

The first version focuses on view control and state filtering.

Required interactions:

- Rotate, zoom, and pan the 3D scene.
- Switch between preset views such as top view, angled overview, and side view.
- Filter by capital state:
  - inflow only
  - outflow only
  - all
- Filter by theme:
  - AI computing power
  - robotics / physical AI
  - low-altitude economy
  - all
- Show only theme centers when needed.
- Switch manual time slices to inspect rotation.

Minimal sector inspection is allowed:

- Sector name
- Primary theme
- capital state
- mock net inflow value

The inspection model should leave space for a future two-layer mode: simple default view, detailed metrics on hover or selection.

## Mock Scenario Data

The first version uses controlled mock data rather than random values. Each time slice should tell a clear market story.

Recommended initial time slices:

| Time slice | Story |
| --- | --- |
| T1 | AI computing power leads; optical modules, CPO, and liquid cooling resonate. |
| T2 | AI computing power diverges at a high level; robotics begins to strengthen. |
| T3 | Robotics expands into sensors and machine vision; low-altitude economy starts to recover. |
| T4 | Low-altitude economy becomes the main peak; AI and robotics partially weaken or consolidate. |

Each time slice provides one capital value per sector. The data layer must guarantee that every visible sector has a value in every time slice.

## Extensible Data Interfaces

The prototype should use replaceable interfaces even though the first implementation uses local configuration.

### LayoutProvider

Returns the sector map layout.

Version-one implementation: static hand-authored configuration.

Future implementation: algorithmic layout based on relationship weights, theme strength, and market regime.

### DataProvider

Returns market scenario data by time slice.

Version-one implementation: local mock scenario data.

Future implementation: public data source, scraping pipeline, database query, or commercial market data API.

### MetricNormalizer

Converts raw capital values into display properties:

- normalized height
- direction
- color state
- intensity
- label value

This keeps visualization independent from future raw data formats.

### ThemeRegistry

Defines theme and sector metadata:

- theme id
- sector id
- display name
- aliases
- primary theme
- related themes
- relationship notes

The registry should support cross-theme relationships even if the first visual position stays singular.

## Suggested Frontend Architecture

The exact framework can be decided during implementation, but the design expects these functional modules:

- App shell: page frame, toolbar, filters, timeline, and scene container.
- Map config module: theme and sector layout data.
- Scenario data module: mock time-slice capital data.
- Data adapter module: combines layout and current time-slice data into renderable sector nodes.
- 3D scene module: renders base cells and columns.
- Interaction state module: current time slice, active theme filter, capital-state filter, selected sector, camera preset.
- Inspector module: minimal sector details.

The scene module should not directly know where the data came from. It should receive already-normalized sector nodes.

## Visual Design Direction

The product should feel like a serious market intelligence instrument, not a marketing landing page.

Design principles:

- Desktop dashboard first.
- Large 3D scene is the primary surface.
- Controls should be compact and predictable.
- Avoid heavy decorative effects that compete with the sector map.
- Use red and green carefully because they carry financial meaning.
- Preserve legibility of sector names and theme clusters.

The first version can be visually restrained. It should feel clear, stable, and extensible before it feels spectacular.

## Testing And Acceptance Criteria

The first version is successful when:

- The three theme centers are visible and understandable.
- Each theme has four to five related sectors positioned around it.
- Sector positions clearly express stronger and weaker relationships.
- Every sector renders exactly one 3D column.
- Positive values render upward red columns.
- Negative values render downward green columns.
- Time-slice switching changes column heights and states without blank scenes.
- Theme and capital-state filters work without hiding all context unexpectedly.
- Camera controls and preset views work on desktop large-screen layouts.
- Ordinary laptop width remains usable, even if it is not the primary target.
- Mock data and layout config can be replaced through provider interfaces later.

## Open Implementation Decisions

These should be decided during the implementation planning step:

- Frontend framework and build tool.
- 3D rendering library setup.
- Exact coordinate system and grid dimensions.
- Exact mock values for each time slice.
- Whether sector labels are rendered in 3D, in overlay HTML, or both.
- Whether the first version needs saved screenshots or a guided demo mode.
