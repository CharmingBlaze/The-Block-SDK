# @modeling-kit/core

**Foundation layer for The Block SDK.** Provides branded ID types, lifecycle management, event emitters, error hierarchy, and result types used by every other package.

## Purpose

The `core` package is the dependency-free bedrock of the SDK. It defines:

- **Branded ID types** — `MeshId`, `FaceId`, `VertexId`, `EdgeId`, `ObjectId`, `MaterialId`, etc. All IDs are compile-time distinguishable via TypeScript branded types to prevent accidental misuse.
- **Lifecycle machines** — `OperationLifecycleMachine` and `ResourceLifecycleMachine` provide state-transition enforcement for long-lived objects.
- **Event emitter** — `Emitter` for typed publish/subscribe patterns without external dependencies.
- **Error classes** — `ModelingKitError`, `SchemaError`, `HierarchyError`, `CyclicHierarchyError`, etc.
- **Result type** — `Result<T, E>` (Ok/Err) for explicit success/failure handling.
- **Diagnostics and dirty tracking** — `SDKDirtyFlag`, `DirtyBatcher`, `ResourceDiagnosticsTracker`.

## Key Exports

```ts
// Branded ID types
import type {
  MeshId, FaceId, VertexId, EdgeId, HalfEdgeId, CornerId,
  ObjectId, NodeId, MaterialId, MaterialSlotId, MaterialInstanceId,
  TextureId, TextureAssetId, TextureSetId, SamplerId,
  UVChannelId, UVVertexId, UVEdgeId, UVFaceId, UVIslandId,
  BoneId, SkeletonId, AnimationId,
  DocumentId, ImageDocumentId, ToolId, LayerId, StrokeId,
  JobId, ViewportId, TileKey,
} from "@modeling-kit/core";

// Brand helper
import { brand } from "@modeling-kit/core";
const meshId = brand<"mesh-01", "MeshId">("mesh-01");

// Lifecycle
import {
  OperationLifecycleMachine,
  ResourceLifecycleMachine,
  IllegalLifecycleTransitionError,
  type Disposable,
} from "@modeling-kit/core";

// Events
import { Emitter, type Handler } from "@modeling-kit/core";

// Result (Either monad)
import { ok, err, type Result } from "@modeling-kit/core";

// Errors
import {
  ModelingKitError,
  SchemaError,
  HierarchyError,
  CyclicHierarchyError,
} from "@modeling-kit/core";

// ID factories
import { createIdFactory, createSequenceIdFactory, type IdFactory } from "@modeling-kit/core";

// Revisions & jobs
import {
  emptyDocumentRevisions,
  emptyMeshRevisions,
  isStaleJobResult,
  type DocumentRevisions,
  type MeshRevisions,
  type RevisionedJobRequest,
} from "@modeling-kit/core";

// Diagnostics
import {
  emptyResourceDiagnostics,
  ResourceDiagnosticsTracker,
  type SDKResourceDiagnostics,
} from "@modeling-kit/core";

// Dirty tracking
import { DirtyBatcher, SDKDirtyFlag } from "@modeling-kit/core";
```

## Usage Example

```ts
import { Emitter, OperationLifecycleMachine, ok, err } from "@modeling-kit/core";

// Typed event emitter
const emitter = new Emitter<{ changed: (id: string) => void }>();
emitter.on("changed", (id) => console.log(`Changed: ${id}`));
emitter.emit("changed", "obj-1");

// Lifecycle enforcement
const machine = new OperationLifecycleMachine();
machine.transition("building"); // moved to building state
machine.transition("ready");    // moved to ready state
// machine.transition("building") // would throw IllegalLifecycleTransitionError

// Result handling
function divide(a: number, b: number): Result<number, string> {
  return b === 0 ? err("Division by zero") : ok(a / b);
}
const result = divide(10, 2);
if (result.ok) {
  console.log(result.value); // 5
}
```

## Architecture Notes

- **Zero dependencies** — this package has no runtime dependencies.
- All ID types are nominal (branded) to prevent accidental interchange at compile time. At runtime they are plain strings.
- The revision system (`DocumentRevisions`, `MeshRevisions`) enables efficient change tracking for viewport synchronization.
- `ResourceDiagnosticsTracker` is designed for development-time leak detection and performance monitoring.
- See `docs/architecture/sdk-architecture.md` for the full package dependency graph.