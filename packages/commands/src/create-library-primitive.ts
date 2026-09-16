import type { Command, CommandContext } from "@modeling-kit/history";
import { serializeMesh, type SerializedMesh } from "@modeling-kit/mesh";
import {
  generateLibraryPrimitive,
  LIBRARY_DISPLAY_NAMES,
  type LibraryGeometryId,
} from "@modeling-kit/primitives";
import type { CreatePrimitiveParams, CreatePrimitiveResult } from "./create-primitive-result";
import {
  persistGeneratedPrimitive,
  restoreGeneratedPrimitive,
  unpersistGeneratedPrimitive,
} from "./persist-generated-primitive";

export class CreateLibraryPrimitiveCommand implements Command<CreatePrimitiveResult> {
  readonly id = crypto.randomUUID();
  readonly label: string;
  private result: CreatePrimitiveResult | null = null;
  private kernel: SerializedMesh | null = null;

  constructor(
    readonly kind: LibraryGeometryId,
    readonly params: CreatePrimitiveParams = {},
  ) {
    this.label = `Create ${LIBRARY_DISPLAY_NAMES[kind]}`;
  }

  execute(context: CommandContext): CreatePrimitiveResult {
    if (this.result && this.kernel) {
      restoreGeneratedPrimitive(
        context,
        this.result,
        this.kernel,
        this.params.name ?? LIBRARY_DISPLAY_NAMES[this.kind],
      );
      return this.result;
    }
    const meshId = context.ids.mesh();
    const generated = generateLibraryPrimitive(this.kind, this.params, { meshId });
    this.result = persistGeneratedPrimitive(
      context,
      generated,
      this.params.name ?? LIBRARY_DISPLAY_NAMES[this.kind],
      meshId,
    );
    this.kernel = serializeMesh(generated.mesh);
    return this.result;
  }

  undo(context: CommandContext): void {
    if (this.result) {
      unpersistGeneratedPrimitive(context, this.result);
    }
  }

  redo(context: CommandContext): CreatePrimitiveResult {
    return this.execute(context);
  }
}
