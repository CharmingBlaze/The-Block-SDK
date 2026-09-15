import type { MaterialId } from "@modeling-kit/core";
import { syncMaterialDualFields, type MaterialData } from "@modeling-kit/document";
import type { Command, CommandContext } from "@modeling-kit/history";
import {
  createStandardPbrMaterial,
  createUnlitMaterial,
  type MaterialDefinition,
} from "@modeling-kit/materials";

export interface CreateMaterialParams {
  readonly id?: MaterialId | undefined;
  readonly name?: string | undefined;
  readonly type?: "standard-pbr" | "unlit" | undefined;
  readonly baseColor?: readonly [number, number, number, number] | undefined;
  readonly color?: readonly [number, number, number, number] | undefined;
  readonly metallic?: number | undefined;
  readonly roughness?: number | undefined;
  readonly emissiveColor?: readonly [number, number, number] | undefined;
  readonly emissiveStrength?: number | undefined;
  readonly opacity?: number | undefined;
  readonly alphaMode?: "opaque" | "mask" | "blend" | undefined;
  readonly alphaCutoff?: number | undefined;
  readonly doubleSided?: boolean | undefined;
  readonly normalScale?: number | undefined;
  readonly occlusionStrength?: number | undefined;
  readonly vertexColors?: boolean | undefined;
  readonly pixelArt?: boolean | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
  readonly material?: MaterialDefinition | undefined;
}

export class CreateMaterialCommand implements Command<MaterialId> {
  readonly id = crypto.randomUUID();
  readonly label = "Create Material";
  private material: MaterialData | null = null;

  constructor(readonly params: CreateMaterialParams = {}) {}

  execute(context: CommandContext): MaterialId {
    if (this.material) {
      context.document.materials.set(this.material);
      context.events.emit("document:changed", {
        aspect: "material",
        entityIds: [this.material.id],
      });
      return this.material.id;
    }

    if (this.params.material) {
      const mat = this.params.material;
      const data: MaterialData = {
        ...mat,
        baseColor: (mat as { baseColor?: readonly [number, number, number, number] }).baseColor ??
          (mat as { color?: readonly [number, number, number, number] }).color ?? [1, 1, 1, 1],
        metallic: (mat as { metallic?: number }).metallic ?? 0,
        roughness: (mat as { roughness?: number }).roughness ?? 0.5,
        emissive: (mat as { emissiveColor?: readonly [number, number, number] }).emissiveColor ?? [0, 0, 0],
        alphaCutoff: (mat as { alphaCutoff?: number }).alphaCutoff ?? 0.5,
        pixelArt: false,
      };
      this.material = data;
      context.document.materials.set(data);
      context.events.emit("document:changed", { aspect: "material", entityIds: [data.id] });
      return data.id;
    }

    const matId = this.params.id ?? context.ids.material();
    const matType = this.params.type ?? "standard-pbr";

    let createdData: MaterialData;
    if (matType === "unlit") {
      const unlit = createUnlitMaterial({
        id: matId,
        name: this.params.name ?? "Unlit Material",
        color: this.params.color ?? this.params.baseColor,
        opacity: this.params.opacity,
        alphaMode: this.params.alphaMode,
        doubleSided: this.params.doubleSided,
        vertexColors: this.params.vertexColors,
        metadata: this.params.metadata,
      });
      createdData = {
        id: unlit.id,
        name: unlit.name,
        type: "unlit",
        baseColor: unlit.color,
        metallic: 0,
        roughness: 1,
        emissive: [0, 0, 0],
        color: unlit.color,
        opacity: unlit.opacity,
        alphaMode: unlit.alphaMode,
        alphaCutoff: 0.5,
        doubleSided: unlit.doubleSided,
        vertexColors: unlit.vertexColors,
        pixelArt: false,
        metadata: unlit.metadata,
      };
    } else {
      const pbr = createStandardPbrMaterial({
        id: matId,
        name: this.params.name ?? "Material",
        baseColor: this.params.baseColor,
        metallic: this.params.metallic,
        roughness: this.params.roughness,
        emissiveColor: this.params.emissiveColor,
        emissiveStrength: this.params.emissiveStrength,
        opacity: this.params.opacity,
        alphaMode: this.params.alphaMode,
        alphaCutoff: this.params.alphaCutoff,
        doubleSided: this.params.doubleSided,
        normalScale: this.params.normalScale,
        occlusionStrength: this.params.occlusionStrength,
        pixelArt: this.params.pixelArt,
        metadata: this.params.metadata,
      });
      createdData = {
        id: pbr.id,
        name: pbr.name,
        type: "standard-pbr",
        baseColor: pbr.baseColor,
        metallic: pbr.metallic,
        roughness: pbr.roughness,
        emissive: pbr.emissiveColor,
        emissiveColor: pbr.emissiveColor,
        emissiveStrength: pbr.emissiveStrength,
        opacity: pbr.opacity,
        alphaMode: pbr.alphaMode,
        alphaCutoff: pbr.alphaCutoff,
        doubleSided: pbr.doubleSided,
        normalScale: pbr.normalScale,
        occlusionStrength: pbr.occlusionStrength,
        pixelArt: pbr.pixelArt ?? false,
        metadata: pbr.metadata,
      };
    }

    this.material = syncMaterialDualFields(createdData);
    context.document.materials.set(createdData);
    context.events.emit("document:changed", { aspect: "material", entityIds: [createdData.id] });
    return createdData.id;
  }

  undo(context: CommandContext): void {
    if (!this.material) {
      return;
    }
    context.document.materials.delete(this.material.id);
    context.events.emit("document:changed", { aspect: "material", entityIds: [this.material.id] });
  }

  redo(context: CommandContext): MaterialId {
    return this.execute(context);
  }
}
