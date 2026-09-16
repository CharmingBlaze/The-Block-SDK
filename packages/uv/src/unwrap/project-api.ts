import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import { packUvs, type PackUvsOptions } from "../pack";
import {
  projectBoxUv,
  projectCylindricalUv,
  projectPlanarUv,
  projectSphericalUv,
} from "../projections";
import type {
  BoxProjectionOptions,
  CylindricalProjectionOptions,
  PlanarProjectionOptions,
  SphericalProjectionOptions,
} from "../types";

export function projectPlanar(mesh: HalfEdgeMesh, options: PlanarProjectionOptions): void {
  projectPlanarUv(mesh, options);
}

export function projectBox(mesh: HalfEdgeMesh, options: BoxProjectionOptions = {}): void {
  projectBoxUv(mesh, options);
}

export function projectCylindrical(mesh: HalfEdgeMesh, options: CylindricalProjectionOptions = {}): void {
  projectCylindricalUv(mesh, options);
}

export function projectSpherical(mesh: HalfEdgeMesh, options: SphericalProjectionOptions = {}): void {
  projectSphericalUv(mesh, options);
}

export function packUvIslands(mesh: HalfEdgeMesh, options: PackUvsOptions = {}): void {
  packUvs(mesh, options);
}
