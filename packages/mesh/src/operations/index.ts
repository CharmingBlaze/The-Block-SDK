export {
  createMeshOperationContext,
  defaultAttributePolicy,
  defaultGeometryTolerance,
  emptyElementMapping,
  runTransactionalMeshOp,
  type AttributePropagationPolicy,
  type ElementMapping,
  type GeometryTolerance,
  type MeshChangeSet,
  type MeshOperationContext,
  type MeshOperationResult,
  type MeshOperationWarning,
  type SelectionSuggestion,
  type TopologyMapping,
  type ValidationMode,
} from "./contract";
export { splitEdge, type SplitEdgeRequest, type SplitEdgeResult } from "./split-edge";
export {
  cutFace,
  type CutEndpoint,
  type CutFaceRequest,
  type CutFaceResult,
} from "./cut-face";
export { connectVertices, type ConnectVerticesRequest } from "./connect-vertices";
export {
  mergeVertices,
  mergeVerticesByDistance,
  type MergeVertexTarget,
  type MergeVerticesRequest,
  type MergeVerticesResult,
} from "./merge-vertices";
export { dissolveEdge, dissolveEdges, type DissolveEdgeRequest, type DissolveEdgeResult } from "./dissolve-edge";
export {
  collapseEdge,
  dissolveFace,
  dissolveVertex,
  reverseFaceWinding,
  type CollapseEdgeRequest,
  type CollapseEdgeResult,
  type DissolveFaceRequest,
  type DissolveFaceResult,
  type DissolveVertexRequest,
  type DissolveVertexResult,
  type ReverseFaceWindingRequest,
} from "./dissolve-collapse";
export {
  triangulateFaces,
  type TriangulateFacesRequest,
  type TriangulateFacesResult,
} from "./triangulate-faces";
export {
  extrudeFaces,
  type ExtrudeFacesOpResult,
  type ExtrudeFacesRequest,
  type ExtrudeFacesResult,
} from "./extrude-faces";
export {
  extrudeRegion,
  type ExtrudeRegionRequest,
  type ExtrudeRegionResult,
} from "./extrude-region";
export { collectQuadEdgeLoop, collectQuadEdgeRing, collectOrientedQuadEdgeLoop, previewLoopCut, loopCut, loopCutFactors, factorOnOrientedEdge, type LoopCutRequest, type LoopCutResult, type LoopCutPreview, type OrientedLoopEdge } from "./loop-cut";
export { bevelEdges, DEFAULT_MITER_LIMIT, type BevelEdgesRequest, type BevelEdgesResult, type BevelWidthMode, type BevelOverlapMode, type SimpleBevelMiterMode, type SimpleBevelOptions } from "./bevel-edges";
export { insetFaces, type InsetFacesOpResult, type InsetFacesRequest, type InsetFacesResult } from "./inset-faces";
export { subdivideFaces, type SubdivideFacesRequest, type SubdivideOpResult, type SubdivideResult } from "./subdivide";
export { bridgeLoops, type BridgeEdgesResult, type BridgeLoopsOpResult as BridgeLoopsResult, type BridgeLoopsOpResult, type BridgeLoopsRequest } from "./bridge-loops";
export {
  fillBoundary,
  type FillBoundaryMethod,
  type FillBoundaryRequest,
  type FillBoundaryResult,
} from "./fill-boundary";
export {
  addEdge,
  addFace,
  addVertex,
  deleteEdges,
  deleteFaces,
  deleteVertices,
  type AddEdgeRequest,
  type AddEdgeResult,
  type AddFaceRequest,
  type AddFaceResult,
  type AddVertexRequest,
  type AddVertexResult,
  type DeleteEdgesRequest,
  type DeleteFacesRequest,
  type DeleteVerticesRequest,
} from "./elements";
export {
  duplicateFaces,
  joinMeshes,
  separateFaces,
  type DuplicateFacesRequest,
  type DuplicateFacesResult,
  type JoinMeshesRequest,
  type JoinMeshesResult,
  type SeparateFacesRequest,
  type SeparateFacesResult,
} from "./duplicate-join";
export {
  trianglesToQuads,
  type TrianglesToQuadsRequest,
  type TrianglesToQuadsResult,
} from "./triangles-to-quads";
export { planKnifeStroke, snapKnifePoint, meshSnapRadius, planKnifeCuts, cutEndpointPoint, type KnifePlan, type KnifePlanCut, type KnifePlanHit, type KnifePlanRequest, type Vec3Tuple, type KnifePoint, type PlannedCut, type KnifeCutPlan } from "./knife-planner";
export { executeKnifePlan, executeKnifeCutPlan, type KnifeExecuteResult } from "./knife-executor";
export {
  catmullClarkSubdivide,
  type CatmullClarkRequest,
  type CatmullClarkResult,
} from "./catmull-clark";
export {
  CREASE_EPSILON,
  CREASE_WEIGHT_MAX,
  CREASE_WEIGHT_MIN,
  clampCreaseWeight,
  isValidCreaseWeight,
  readCreaseWeight,
  repairEdgeCreaseWeights,
  requireCreaseWeight,
  setEdgeCreaseWeights,
  storedCreaseWeight,
  type EdgeCreaseWeight,
  type RepairCreaseWeightsResult,
  type SetEdgeCreaseWeightsRequest,
} from "./creases";
export { slideVertex, type VertexSlideRequest, type VertexSlideResult } from "./vertex-slide";
export { computeProportionalInfluence, applyFalloff, type ProportionalFalloff, type ProportionalVertex, type ProportionalEditOptions } from "./proportional-edit";
export { validateFaceInsertion, type AddFaceRequest as AddFaceRequestForValidation } from "./face-insertion";
export {
  AttributePropagationService,
  attributePropagationDefaults,
  type AttributePolicy,
  type AttributeSplitContext,
  type AttributeInterpolationContext,
  type AttributeDuplicateContext,
  type AttributeRemapPolicy,
  type AttributeRemapResult,
} from "./attribute-propagation";