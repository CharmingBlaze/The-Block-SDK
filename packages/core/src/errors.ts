export class ModelingKitError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ModelingKitError";
    this.code = code;
  }
}

export class CyclicHierarchyError extends ModelingKitError {
  constructor(nodeId: string, newParentId: string) {
    super(
      "CYCLIC_HIERARCHY",
      `Cannot reparent '${nodeId}' under '${newParentId}': that would create a cycle`,
    );
    this.name = "CyclicHierarchyError";
  }
}

export class NodeNotFoundError extends ModelingKitError {
  constructor(nodeId: string) {
    super("NODE_NOT_FOUND", `Scene node '${nodeId}' does not exist`);
    this.name = "NodeNotFoundError";
  }
}

export class SingularTransformError extends ModelingKitError {
  constructor(message = "Transform cannot be inverted (singular or zero scale)") {
    super("SINGULAR_TRANSFORM", message);
    this.name = "SingularTransformError";
  }
}

export class HierarchyError extends ModelingKitError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = "HierarchyError";
  }
}

export class SchemaError extends ModelingKitError {
  constructor(message: string) {
    super("SCHEMA", message);
    this.name = "SchemaError";
  }
}

export class UnsupportedSchemaVersionError extends ModelingKitError {
  constructor(
    readonly foundVersion: number,
    readonly maxSupported: number,
  ) {
    super(
      "UNSUPPORTED_SCHEMA",
      `Document schemaVersion ${foundVersion} is newer than supported version ${maxSupported}`,
    );
    this.name = "UnsupportedSchemaVersionError";
  }
}
