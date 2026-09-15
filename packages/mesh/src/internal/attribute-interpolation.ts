export function lerpScalar(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpUv(
  a: readonly [number, number],
  b: readonly [number, number],
  t: number,
): [number, number] {
  return [lerpScalar(a[0], b[0], t), lerpScalar(a[1], b[1], t)];
}

export function lerpVec3(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  t: number,
): [number, number, number] {
  return [lerpScalar(a[0], b[0], t), lerpScalar(a[1], b[1], t), lerpScalar(a[2], b[2], t)];
}

export function lerpColor(
  a: readonly [number, number, number, number],
  b: readonly [number, number, number, number],
  t: number,
): [number, number, number, number] {
  return [
    lerpScalar(a[0], b[0], t),
    lerpScalar(a[1], b[1], t),
    lerpScalar(a[2], b[2], t),
    lerpScalar(a[3], b[3], t),
  ];
}

export interface SkinInfluence {
  readonly boneId: string;
  readonly weight: number;
}

export function interpolateSkinWeights(
  a: readonly SkinInfluence[],
  b: readonly SkinInfluence[],
  t: number,
  normalize: boolean,
): SkinInfluence[] {
  const byBone = new Map<string, number>();
  for (const influence of a) {
    byBone.set(influence.boneId, (byBone.get(influence.boneId) ?? 0) + influence.weight * (1 - t));
  }
  for (const influence of b) {
    byBone.set(influence.boneId, (byBone.get(influence.boneId) ?? 0) + influence.weight * t);
  }
  const merged = [...byBone.entries()].map(([boneId, weight]) => ({ boneId, weight }));
  if (!normalize) {
    return merged;
  }
  const sum = merged.reduce((acc, item) => acc + item.weight, 0);
  if (sum <= 0) {
    return merged;
  }
  return merged.map((item) => ({ boneId: item.boneId, weight: item.weight / sum }));
}
