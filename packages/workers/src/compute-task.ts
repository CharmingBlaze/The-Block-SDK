import { deserializeMesh, serializeMesh, triangulateMesh } from "@modeling-kit/mesh";
import { validateMesh } from "@modeling-kit/validation";
import { packUvs } from "@modeling-kit/uv";
import type { TaskPayload } from "./types";
import { runUnwrapUvTask } from "./unwrap-task";

export async function runComputeTask(task: TaskPayload, signal?: AbortSignal): Promise<unknown> {
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
  if (task.type === "unwrap-uv") {
    return runUnwrapUvTask(task.payload.input, task.payload.options, signal);
  }
  throw new Error("Unknown task type");
}
