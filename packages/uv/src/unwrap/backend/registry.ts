import { XAtlasUnwrapBackend } from "./xatlas/backend";
import type { UvUnwrapBackend } from "../types";

let shared: UvUnwrapBackend | null = null;

export function getUvUnwrapBackend(): UvUnwrapBackend {
  shared ??= new XAtlasUnwrapBackend();
  return shared;
}

export function setUvUnwrapBackend(backend: UvUnwrapBackend | null): void {
  shared = backend;
}

export function createXAtlasUnwrapBackend(): XAtlasUnwrapBackend {
  return new XAtlasUnwrapBackend();
}
