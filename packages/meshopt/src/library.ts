import { MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";

export async function loadEncoder(): Promise<typeof MeshoptEncoder> {
  if (!MeshoptEncoder.supported) {
    throw new Error("meshoptimizer encoder is not supported in this runtime");
  }
  await MeshoptEncoder.ready;
  return MeshoptEncoder;
}

export async function loadSimplifier(): Promise<typeof MeshoptSimplifier> {
  if (!MeshoptSimplifier.supported) {
    throw new Error("meshoptimizer simplifier is not supported in this runtime");
  }
  await MeshoptSimplifier.ready;
  return MeshoptSimplifier;
}
