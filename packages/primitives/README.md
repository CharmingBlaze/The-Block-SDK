# @modeling-kit/primitives

**Primitive geometry generators.** Creates validated, properly-welded `HalfEdgeMesh` instances for all standard shapes — boxes, spheres, cylinders, cones, capsules, toruses, pyramids, planes, and architectural elements.

## Purpose

The `primitives` package is a **pure geometry generator library** with:

- **Standard primitives**: box, UV sphere, icosphere, quad sphere, rounded cube, cylinder, cone, capsule, torus, pyramid, plane, disc, circle, grid, quad
- **Architectural primitives**: arch, column, ramp, stairs, wall
- **Profile extrusion**: extrude a 2D profile along a path (e.g., baseboards, crown molding)
- **Library conversion**: convert simplicial complex data (from CAD systems) into half-edge meshes
- **Validation**: every primitive validates its parameters and returns structured validation results
- **Catalog system**: extensible registry of primitive types with display names and metadata

## Key Exports

```ts
// Box
import { generateBox, generateSubdividedBox, boxDefaults, validateBoxParameters } from "@modeling-kit/primitives";

// Spheres
import {
  generateUvSphere, generateIcosphere,
  uvSphereDefaults, icosphereDefaults,
  validateUvSphereParameters, validateIcosphereParameters,
} from "@modeling-kit/primitives";

// Solids
import {
  generateCylinder, generateCone, generateCapsule, generatePyramid,
  cylinderDefaults, coneDefaults, capsuleDefaults, pyramidDefaults,
} from "@modeling-kit/primitives";

// Planar
import {
  generatePlane, generateDisc, generateCircle, generateGrid, generateQuad,
  planeDefaults, discDefaults, gridDefaults, quadDefaults,
} from "@modeling-kit/primitives";

// Torus
import { generateTorus, torusDefaults, validateTorusParameters } from "@modeling-kit/primitives";

// Architecture
import {
  generateArch, generateColumn, generateRamp, generateStairs, generateWall,
} from "@modeling-kit/primitives";

// Catalog
import {
  generatePrimitive, type PrimitiveCreateParams,
  PRIMITIVE_CATALOG, getPrimitiveCatalogEntry,
  canonicalizePrimitiveType, PRIMITIVE_TYPE_ALIASES,
  type PrimitiveType, type PrimitiveCatalogEntry,
} from "@modeling-kit/primitives";

// Profile extrude
import {
  generateProfileExtrude, generateFloor, generateWallPath,
  ProfileExtrudePreview, validateProfile, validateExtrudeParameters,
  type ProfileDefinition, type ProfileExtrudeParameters,
} from "@modeling-kit/primitives";

// Library
import {
  convertSimplicialComplex, generateLibraryPrimitive,
  validateLibraryParameters, resolveCellSize,
  LIBRARY_CLOSED, LIBRARY_DISPLAY_NAMES, LIBRARY_GEOMETRY_IDS,
} from "@modeling-kit/primitives";
```

## Usage Example

```ts
import { generateBox, generateCylinder, generateUvSphere } from "@modeling-kit/primitives";

// Simple primitives
const box = generateBox({ width: 2, height: 1, depth: 3 });
console.log(box.faces.size); // 6

const cyl = generateCylinder({ radius: 0.5, height: 2, segments: 32 });
console.log(cyl.faces.size); // 96 (32 sides × 3 rings)

const sphere = generateUvSphere({ radius: 1, rings: 16, segments: 32 });

// Catalog-based generation (for UI-driven creation)
import { generatePrimitive } from "@modeling-kit/primitives";
const result = generatePrimitive({ type: "roundedCube", params: { size: 2, radius: 0.2 } });
```

## Architecture Notes

- All generators return `HalfEdgeMesh` instances — they are immediately usable for modeling operations.
- Each primitive includes **face groups** (tags like `"top"`, `"bottom"`, `"sides"`, `"caps"`) enabling `editor.spawn.cube().select("top").extrude(0.5)` fluent patterns.
- The **catalog system** (`PRIMITIVE_CATALOG`) is an extensible registry — applications can register custom primitive types.
- `ProfileExtrudePreview` provides a **live preview mesh** that updates as the user draws a profile, enabling interactive CAD-style modeling.
- `convertSimplicialComplex` bridges between external CAD formats (triangle soups) and the half-edge kernel.