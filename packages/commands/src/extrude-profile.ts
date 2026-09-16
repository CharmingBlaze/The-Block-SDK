import type { Command, CommandContext } from "@modeling-kit/history";
import { serializeMesh, type SerializedMesh } from "@modeling-kit/mesh";
import {
  generateProfileExtrude,
  type ProfileExtrudeParameters,
} from "@modeling-kit/primitives";
import type { CreatePrimitiveResult } from "./create-primitive-result";
import {
  persistGeneratedPrimitive,
  restoreGeneratedPrimitive,
  unpersistGeneratedPrimitive,
} from "./persist-generated-primitive";

export class ExtrudeProfileCommand implements Command<CreatePrimitiveResult> {
  readonly id = crypto.randomUUID();
  readonly label: string;
  private result: CreatePrimitiveResult | null = null;
  private kernel: SerializedMesh | null = null;

  constructor(readonly params: ProfileExtrudeParameters) {
    this.label =
      params.name ??
      (params.profile.kind === "path" ? "Extrude Path" : "Extrude Profile");
  }

  execute(context: CommandContext): CreatePrimitiveResult {
    if (this.result && this.kernel) {
      restoreGeneratedPrimitive(context, this.result, this.kernel, this.label);
      return this.result;
    }
    const meshId = context.ids.mesh();
    const generated = generateProfileExtrude(this.params, { meshId });
    this.result = persistGeneratedPrimitive(context, generated, this.label, meshId);
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
