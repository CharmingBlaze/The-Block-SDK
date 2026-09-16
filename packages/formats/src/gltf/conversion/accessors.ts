import type { Accessor } from "@gltf-transform/core";

export function accessorToNumbers(accessor: Accessor | null): number[] {
  if (!accessor) {
    return [];
  }
  const array = accessor.getArray();
  if (!array) {
    return [];
  }
  return Array.from(array, (value) => Number(value));
}

export function accessorCount(accessor: Accessor | null): number {
  return accessor?.getCount() ?? 0;
}
