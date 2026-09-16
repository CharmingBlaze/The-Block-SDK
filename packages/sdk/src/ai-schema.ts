export interface ToolValidationIssue {
  readonly code: "unknown_property" | "missing_required" | "type" | "enum" | "range";
  readonly path: string;
  readonly message: string;
}

export class ToolArgumentError extends TypeError {
  readonly code = "invalid_argument";
  readonly retryable = true;
  readonly field?: string;
  readonly issues: readonly ToolValidationIssue[];

  constructor(message: string, options: { field?: string; issues?: readonly ToolValidationIssue[] } = {}) {
    super(message);
    this.name = "ToolArgumentError";
    if (options.field !== undefined) {
      this.field = options.field;
    }
    this.issues = options.issues ?? [];
  }
}

export function validateJsonSchema(
  schema: unknown,
  value: unknown,
  path = "",
): ToolValidationIssue[] {
  if (!isRecord(schema) || typeof schema.type !== "string") {
    return [{ code: "type", path, message: `${label(path)} has an unsupported schema` }];
  }
  switch (schema.type) {
    case "object":
      return validateObject(schema, value, path);
    case "string":
      return validateString(schema, value, path);
    case "number":
      return validateNumber(value, path, false);
    case "integer":
      return validateNumber(value, path, true);
    case "boolean":
      return typeof value === "boolean"
        ? []
        : [{ code: "type", path, message: `${label(path)} must be a boolean` }];
    case "array":
      return validateArray(schema, value, path);
    default:
      return [{ code: "type", path, message: `${label(path)} has an unsupported schema type` }];
  }
}

export function assertValidToolArgs(schema: unknown, value: unknown): Record<string, unknown> {
  const issues = validateJsonSchema(schema, value);
  if (issues.length > 0) {
    const first = issues[0]!;
    throw new ToolArgumentError(first.message, {
      ...(first.path.length > 0 ? { field: first.path } : {}),
      issues,
    });
  }
  return value as Record<string, unknown>;
}

function validateObject(
  schema: Record<string, unknown>,
  value: unknown,
  path: string,
): ToolValidationIssue[] {
  if (!isRecord(value) || Array.isArray(value)) {
    return [{ code: "type", path, message: `${label(path)} must be a JSON object` }];
  }
  const issues: ToolValidationIssue[] = [];
  const properties = isRecord(schema.properties) ? schema.properties : {};
  const required = Array.isArray(schema.required)
    ? schema.required.filter((item): item is string => typeof item === "string")
    : [];
  for (const key of required) {
    if (!(key in value)) {
      issues.push({
        code: "missing_required",
        path: joinPath(path, key),
        message: `Missing required argument: ${joinPath(path, key)}`,
      });
    }
  }
  if (schema.additionalProperties === false) {
    for (const key of Object.keys(value)) {
      if (!(key in properties)) {
        issues.push({
          code: "unknown_property",
          path: joinPath(path, key),
          message: `Unknown argument: ${joinPath(path, key)}`,
        });
      }
    }
  }
  for (const [key, child] of Object.entries(properties)) {
    if (key in value) {
      issues.push(...validateJsonSchema(child, value[key], joinPath(path, key)));
    }
  }
  return issues;
}

function validateString(
  schema: Record<string, unknown>,
  value: unknown,
  path: string,
): ToolValidationIssue[] {
  if (typeof value !== "string") {
    return [{ code: "type", path, message: `${label(path)} must be a string` }];
  }
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    return [
      {
        code: "enum",
        path,
        message: `${label(path)} must be one of: ${schema.enum.filter((item) => typeof item === "string").join(", ")}`,
      },
    ];
  }
  return [];
}

function validateNumber(value: unknown, path: string, integer: boolean): ToolValidationIssue[] {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return [{ code: "type", path, message: `${label(path)} must be a finite number` }];
  }
  if (integer && !Number.isInteger(value)) {
    return [{ code: "type", path, message: `${label(path)} must be an integer` }];
  }
  return [];
}

function validateArray(
  schema: Record<string, unknown>,
  value: unknown,
  path: string,
): ToolValidationIssue[] {
  if (!Array.isArray(value)) {
    return [{ code: "type", path, message: `${label(path)} must be an array` }];
  }
  const issues: ToolValidationIssue[] = [];
  if (typeof schema.minItems === "number" && value.length < schema.minItems) {
    issues.push({
      code: "range",
      path,
      message: `${label(path)} must contain at least ${String(schema.minItems)} items`,
    });
  }
  if (typeof schema.maxItems === "number" && value.length > schema.maxItems) {
    issues.push({
      code: "range",
      path,
      message: `${label(path)} must contain at most ${String(schema.maxItems)} items`,
    });
  }
  if ("items" in schema) {
    for (const [index, item] of value.entries()) {
      issues.push(...validateJsonSchema(schema.items, item, `${path}[${index}]`));
    }
  }
  return issues;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function joinPath(base: string, key: string): string {
  return base ? `${base}.${key}` : key;
}

function label(path: string): string {
  return path.length > 0 ? path : "arguments";
}
