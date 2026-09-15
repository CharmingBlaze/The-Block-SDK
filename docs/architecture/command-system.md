# Command & History Architecture

**Packages:** `@modeling-kit/commands`, `@modeling-kit/history`, `@modeling-kit/selection`  
**License posture:** Clean-room independent implementation. No GPL code.

---

## 1. Overview and Core Philosophy

All persistent state changes in the SDK are enacted through the **Command System**. Direct mutation of the document or mesh kernel from outside commands is disallowed.

Architectural guarantees:

1. **Exact Reversibility:** Every command records exact reverse patches or snapshots of affected entities. Geometry topology operations never rely on floating-point reversal (e.g. subtracting an offset instead of restoring vertices).
2. **Transaction Batching:** Multi-step operations and script executions group into atomic transactions that undo/redo as a single step.
3. **Transient Previews:** Real-time pointer drags (translate, rotate, scale, bevel preview) update a transient preview state without polluting the undo stack. A single command is committed on pointer release.
4. **Selection Survivability:** Commands that alter topology return ID remappings and selection transfer sets, preserving selection across extrusions, bevels, splits, and cuts.

---

## 2. Command Protocol

```ts
export interface CommandContext {
  readonly session: EditorSession;
  readonly document: ModelDocument;
  /** Emits granular changes for incremental viewport sync */
  emitChange(change: DocumentChange): void;
}

export interface Command<TResult = unknown> {
  readonly id: string;
  readonly label: string;
  execute(context: CommandContext): TResult;
  undo(context: CommandContext): void;
  redo?(context: CommandContext): TResult;
  mergeWith?(next: Command): Command | null;
  serialize?(): SerializedCommand;
}
```

---

## 3. History Management & Transactions

The `CommandManager` orchestrates the undo/redo stacks:

```ts
export interface CommandHistory {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly undoStack: readonly CommandRecord[];
  readonly redoStack: readonly CommandRecord[];
  readonly isDirty: boolean;
  readonly maxHistoryDepth: number;

  execute<T>(command: Command<T>): T;
  beginTransaction(label: string): TransactionHandle;
  commitTransaction(handle: TransactionHandle): void;
  rollbackTransaction(handle: TransactionHandle): void;
  undo(): void;
  redo(): void;
  markSaved(): void;
  clear(): void;
}
```

### 3.1 Pointer Drag & Coalescing Life Cycle

1. **Pointer Down:** Capture initial snapshot / baseline transform.
2. **Pointer Move:** Apply continuous delta directly to the transient viewport preview or session scratchpad. Zero history commands generated.
3. **Pointer Up (Commit):**
   - If significant delta ($\Delta > \epsilon$): Instantiate concrete `TransformCommand` with initial and final parameters; push to undo stack; mark document dirty.
   - If trivial delta ($\Delta \le \epsilon$): Discard preview; push nothing to history.
4. **Escape Key (Cancel):** Immediately revert transient preview to initial snapshot. Zero history artifacts.

---

## 4. Topology Mutation & Exact Reversal Strategy

Topology changes (extrusions, bevels, loop cuts) modify vertices, edges, half-edges, and faces.

To prevent cumulative floating-point errors and corrupt topological states:

1. **Delta & Element Snapshots:** A command captures the exact prior state of any modified or deleted vertices, half-edges, and faces.
2. **ID Allocation:** Any newly created elements receive deterministic IDs allocated during `execute()`. During `redo()`, the identical IDs are reused.
3. **Selection Remapping:**
   ```ts
   export interface TopologyRemapping {
     readonly vertexRemap: ReadonlyMap<VertexId, VertexId[]>;
     readonly edgeRemap: ReadonlyMap<EdgeId, EdgeId[]>;
     readonly faceRemap: ReadonlyMap<FaceId, FaceId[]>;
   }
   ```
   When extruding a face $F_0$, $F_0$ is deleted or transformed into cap face $F_{\text{cap}}$ and side quad faces $F_1, F_2, F_3, F_4$. The command returns a remapping transferring active selection to $F_{\text{cap}}$, preserving intuitive workflow for the user.

---

## 5. Event Dispatching & Subscription

Event listeners receive batched notifications after transaction completion:

```ts
export interface EditorEvents {
  "document:changed": DocumentChangeSet;
  "selection:changed": SelectionChange;
  "history:changed": HistoryState;
  "tool:changed": ToolChange;
  "mesh:topology-changed": MeshTopologyChange;
}
```

- Events are dispatched asynchronously or batched at transaction end to avoid render thrashing.
- Unhandled subscriber errors are caught and logged, preventing corruption of core editor state.
