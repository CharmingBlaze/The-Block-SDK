import type { Command, CommandContext } from "@modeling-kit/history";
import { deserializeMesh, serializeMesh, type HalfEdgeMesh, type SerializedMesh } from "@modeling-kit/mesh";
import type { CreatePrimitiveResult } from "./create-primitive-result";
import { persistImportedMesh, restoreGeneratedPrimitive, unpersistGeneratedPrimitive } from "./persist-generated-primitive";

export class ImportMeshCommand implements Command<CreatePrimitiveResult> {
  readonly id = crypto.randomUUID();
  readonly label: string;
  private readonly kernel: SerializedMesh;
  private result: CreatePrimitiveResult | null = null;

  constructor(mesh: HalfEdgeMesh, name = "Imported") {
    this.kernel = serializeMesh(mesh);
    this.label = `Import ${name}`;
    this.name = name;
  }

  private readonly name: string;

  execute(context: CommandContext): CreatePrimitiveResult {
    if (this.result) {
      restoreGeneratedPrimitive(context, this.result, this.kernel, this.name);
      return this.result;
    }
    this.result = persistImportedMesh(context, deserializeMesh(this.kernel), this.name);
    return this.result;
  }

  undo(context: CommandContext): void {
    if (!this.result) {
      return;
    }
    unpersistGeneratedPrimitive(context, this.result);
  }
}
