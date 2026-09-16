import type { EdgeCreaseWeight } from "../../types";
import type { ValidationMode } from "../contract";
import {
  CREASE_WEIGHT_MAX,
  CREASE_WEIGHT_MIN,
} from "./types";

export function isValidCreaseWeight(value: unknown): value is EdgeCreaseWeight {
  return typeof value === "number" && Number.isFinite(value) && value >= CREASE_WEIGHT_MIN && value <= CREASE_WEIGHT_MAX;
}

export function clampCreaseWeight(value: number): EdgeCreaseWeight {
  if (!Number.isFinite(value)) {
    return CREASE_WEIGHT_MIN;
  }
  if (value < CREASE_WEIGHT_MIN) {
    return CREASE_WEIGHT_MIN;
  }
  if (value > CREASE_WEIGHT_MAX) {
    return CREASE_WEIGHT_MAX;
  }
  return value;
}

export function requireCreaseWeight(
  value: unknown,
  mode: ValidationMode = "strict",
): EdgeCreaseWeight {
  if (isValidCreaseWeight(value)) {
    return value;
  }
  if (mode === "repair" && typeof value === "number") {
    return clampCreaseWeight(value);
  }
  throw new RangeError(
    `invalid-crease-weight: crease weights must be finite values in [${CREASE_WEIGHT_MIN}, ${CREASE_WEIGHT_MAX}]`,
  );
}

export function storedCreaseWeight(value: EdgeCreaseWeight | undefined): EdgeCreaseWeight {
  return value === undefined ? CREASE_WEIGHT_MIN : value;
}
