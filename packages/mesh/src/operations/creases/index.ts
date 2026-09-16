export {
  CREASE_EPSILON,
  CREASE_WEIGHT_MAX,
  CREASE_WEIGHT_MIN,
  type EdgeCreaseWeight,
  type RepairCreaseWeightsResult,
  type SetEdgeCreaseWeightsRequest,
} from "./types";
export {
  clampCreaseWeight,
  isValidCreaseWeight,
  requireCreaseWeight,
  storedCreaseWeight,
} from "./validate";
export { readCreaseWeight, repairEdgeCreaseWeights, setEdgeCreaseWeights } from "./set";
