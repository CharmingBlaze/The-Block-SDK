/**
 * @packageDocumentation
 * Public type contracts for the `@modeling-kit/sdk/ai` tool surface.
 *
 * These describe the OpenAI-style "function" schema a model sees and the
 * structured result returned by `executeEditorTool`. Keeping them isolated
 * lets tool authors import `EditorToolResult` etc. without pulling in the
 * executor (`./ai`) or the schema catalog (`./ai-tool-catalog`).
 */
import type { SceneInspectionResult } from "@modeling-kit/commands";
import type { EditorToolFailureCode, ToolValidationIssue } from "./ai-schema";

/** A JSON-Schema `object` node restricted to the subset validated at runtime. */
export interface JsonSchemaObject {
  readonly type: "object";
  readonly properties: Record<string, unknown>;
  readonly required?: readonly string[];
  readonly additionalProperties: false;
}

/** An OpenAI-compatible function-call definition for a single editor tool. */
export interface EditorToolDefinition {
  readonly type: "function";
  readonly function: {
    readonly name: string;
    readonly description: string;
    readonly parameters: JsonSchemaObject;
  };
}

/** Successful tool execution; `data` is tool-specific and schema-shaped. */
export type EditorToolSuccess = {
  readonly ok: true;
  readonly tool: string;
  readonly inspection: SceneInspectionResult;
  readonly data?: unknown;
  readonly clientRequestId?: string;
};

/**
 * Failed tool execution. `code`/`retryable`/`issues[]` are the structured
 * signals an autonomous agent uses to decide whether to retry or correct its
 * own arguments.
 */
export type EditorToolFailure = {
  readonly ok: false;
  readonly tool: string;
  readonly error: string;
  readonly inspection: SceneInspectionResult;
  readonly code: EditorToolFailureCode;
  readonly retryable: boolean;
  readonly field?: string;
  readonly issues?: readonly ToolValidationIssue[];
  readonly clientRequestId?: string;
};

/** Discriminated union of success/failure keyed on `ok`. */
export type EditorToolResult = EditorToolSuccess | EditorToolFailure;