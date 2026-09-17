import type { Command, CommandContext } from "@modeling-kit/history";
import type { TransformData } from "@modeling-kit/math";
import { serializeMesh, type SerializedMesh } from "@modeling-kit/mesh";
import {
  canonicalizePrimitiveType,
  generatePrimitive,
  primitiveDisplayNames,
  type PrimitiveType,
} from "@modeling-kit/primitives";
import type { CreatePrimitiveParams, CreatePrimitiveResult } from "./create-primitive-result";
import {
  persistGeneratedPrimitive,
  restoreGeneratedPrimitive,
  unpersistGeneratedPrimitive,
} from "./persist-generated-primitive";

export type { CreatePrimitiveParams, CreatePrimitiveResult, PrimitiveType } from "./create-primitive-result";

export class CreatePrimitiveCommand implements Command<CreatePrimitiveResult> {
  readonly id = crypto.randomUUID();
  readonly label: string;
  private result: CreatePrimitiveResult | null = null;
  private kernel: SerializedMesh | null = null;

  constructor(
    primitive: PrimitiveType | string,
    readonly params: CreatePrimitiveParams = {},
    readonly options: { readonly localTransform?: TransformData } = {},
  ) {
    this.primitive = canonicalizePrimitiveType(primitive);
    this.label = `Create ${primitiveDisplayNames[this.primitive]}`;
  }

  readonly primitive: PrimitiveType;

  execute(context: CommandContext): CreatePrimitiveResult {
    if (this.result && this.kernel) {
      restoreGeneratedPrimitive(
        context,
        this.result,
        this.kernel,
        this.params.name ?? primitiveDisplayNames[this.primitive],
        this.options.localTransform,
      );
      return this.result;
    }
    const meshId = context.ids.mesh();
    const isBox = this.primitive === "cube" || this.primitive === "box";
    const faceIds = isBox
      ? {
          posX: context.ids.face(),
          negX: context.ids.face(),
          posY: context.ids.face(),
          negY: context.ids.face(),
          posZ: context.ids.face(),
          negZ: context.ids.face(),
        }
      : undefined;
    const generated = generatePrimitive(this.primitive, this.params, {
      meshId,
      ...(faceIds ? { faceIds } : {}),
    });
    this.result = persistGeneratedPrimitive(
      context,
      generated,
      this.params.name ?? primitiveDisplayNames[this.primitive],
      meshId,
      faceIds,
      this.options.localTransform,
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
