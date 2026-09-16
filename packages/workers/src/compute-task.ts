import { deserializeMesh, serializeMesh, triangulateMesh } from "@modeling-kit/mesh";
import { validateMesh } from "@modeling-kit/validation";
import { packUvs } from "@modeling-kit/uv";
import type { TaskPayload } from "./types";

export function runComputeTask(task: TaskPayload, signal?: AbortSignal): unknown {
  if (signal?.aborted) {
    throw new Error("cancelled");
  }
  if (task.type === "triangulate") {
    const mesh = deserializeMesh(task.payload.serializedMesh);
    return triangulateMesh(mesh, signal ? { signal } : {});
  }
  if (task.type === "pack-uv") {
    const mesh = deserializeMesh(task.payload.serializedMesh);
    packUvs(mesh, task.payload.options);
    return serializeMesh(mesh);
  }
  if (task.type === "validate") {
    const mesh = deserializeMesh(task.payload.serializedMesh);
    return validateMesh(mesh);
  }
  throw new Error("Unknown task type");
}
