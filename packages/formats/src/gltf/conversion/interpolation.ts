import type { AnimationChannel, AnimationInterpolation } from "@modeling-kit/document";
import { interpolateHermite } from "@modeling-kit/animation";

export function gltfPathToChannel(path: string): AnimationChannel | undefined {
  if (path === "translation") {
    return "position";
  }
  if (path === "rotation" || path === "scale") {
    return path;
  }
  return undefined;
}

export function channelToGltfPath(channel: AnimationChannel): "translation" | "rotation" | "scale" | undefined {
  if (channel === "visibility") {
    return undefined;
  }
  if (channel === "position") {
    return "translation";
  }
  return channel;
}

export function fromGltfInterpolation(
  interpolation: "LINEAR" | "STEP" | "CUBICSPLINE" | string,
): AnimationInterpolation | "cubicspline" {
  if (interpolation === "STEP") {
    return "constant";
  }
  if (interpolation === "CUBICSPLINE") {
    return "cubicspline";
  }
  return "linear";
}

export function toGltfInterpolation(interpolation: AnimationInterpolation): "LINEAR" | "STEP" {
  return interpolation === "constant" ? "STEP" : "LINEAR";
}

/** Sample glTF CUBICSPLINE (in, value, out) * components onto linear keys. */
export function approximateCubicSpline(
  times: readonly number[],
  values: readonly number[],
  components: number,
  samplesPerSpan = 4,
): { times: number[]; values: number[] } {
  const keyCount = times.length;
  const stride = components * 3;
  const outTimes: number[] = [];
  const outValues: number[] = [];
  const writeKey = (time: number, offset: number): void => {
    outTimes.push(time);
    const valueOffset = offset + components;
    for (let c = 0; c < components; c += 1) {
      outValues.push(values[valueOffset + c] ?? 0);
    }
  };
  if (keyCount === 0) {
    return { times: outTimes, values: outValues };
  }
  writeKey(times[0]!, 0);
  for (let i = 0; i < keyCount - 1; i += 1) {
    const t0 = times[i]!;
    const t1 = times[i + 1]!;
    const dt = t1 - t0;
    const a = i * stride;
    const b = (i + 1) * stride;
    for (let s = 1; s <= samplesPerSpan; s += 1) {
      const t = s / samplesPerSpan;
      const time = t0 + dt * t;
      outTimes.push(time);
      for (let c = 0; c < components; c += 1) {
        const p0 = values[a + components + c] ?? 0;
        const m0 = values[a + 2 * components + c] ?? 0;
        const p1 = values[b + components + c] ?? 0;
        const m1 = values[b + c] ?? 0;
        outValues.push(interpolateHermite(p0, m0, p1, m1, t, dt));
      }
    }
  }
  return { times: outTimes, values: outValues };
}
