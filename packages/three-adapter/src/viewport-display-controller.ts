import {
  ACESFilmicToneMapping,
  Box3,
  Color,
  DataTexture,
  DirectionalLight,
  DoubleSide,
  Group,
  HemisphereLight,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshNormalMaterial,
  MeshStandardMaterial,
  NearestFilter,
  PCFSoftShadowMap,
  PlaneGeometry,
  RGBAFormat,
  RepeatWrapping,
  ShadowMaterial,
  SRGBColorSpace,
  UnsignedByteType,
  Vector3,
  type Camera,
  type Material,
  type Object3D,
  type Scene,
  type Texture,
  type WebGLRenderer,
} from "three";
import {
  ViewportRenderState,
  modeSupportsShadows,
  shadowMapSizeForQuality,
  type ViewportRenderMode,
  type ViewportRenderSettings,
  type ViewportRenderSettingsInput,
} from "./viewport-display-settings";

export interface ViewportDisplayControllerOptions {
  readonly renderer: WebGLRenderer;
  readonly scene: Scene;
  readonly camera: Camera;
  readonly presentationRoot: Object3D;
  readonly grid?: Object3D;
  readonly initial?: ViewportRenderSettingsInput;
  readonly getSelectedObjects?: () => Object3D[];
  readonly setTopologyEdges?: (visible: boolean) => void;
  readonly lightingEnabled?: boolean;
}

type MaterialSwap = { mesh: Mesh; material: Material | Material[] };
type MaterialCache = Map<Material, Map<string, Material>>;

const TEXTURE_SLOTS = [
  "map", "alphaMap", "aoMap", "bumpMap", "displacementMap", "emissiveMap",
  "lightMap", "metalnessMap", "normalMap", "roughnessMap",
] as const;

/**
 * Per-viewport owner for derived materials, topology/triangle overlays, studio
 * lights, ground receiver, and the single directional shadow map.
 */
export class ViewportDisplayController {
  readonly state: ViewportRenderState;
  private readonly renderer: WebGLRenderer;
  private readonly scene: Scene;
  private readonly camera: Camera;
  private readonly presentationRoot: Object3D;
  private readonly grid: Object3D | undefined;
  private readonly getSelectedObjects: () => Object3D[];
  private readonly setTopologyEdges: (visible: boolean) => void;
  private readonly lightingEnabled: boolean;
  private readonly lightRig = new Group();
  private readonly keyLight = new DirectionalLight(0xffffff, 2.5);
  private readonly fillLight = new DirectionalLight(0xb8c8ff, 0.55);
  private readonly rimLight = new DirectionalLight(0xffe6c8, 0.7);
  private readonly hemisphere = new HemisphereLight(0xddeeff, 0x242432, 0.72);
  private readonly floorGeometry = new PlaneGeometry(1, 1);
  private readonly floorMaterial = new ShadowMaterial({ color: 0x000000, transparent: true, opacity: 0.22 });
  private readonly floor = new Mesh(this.floorGeometry, this.floorMaterial);
  private readonly materialCache: MaterialCache = new Map();
  private readonly ownedTextures = new Set<Texture>();
  private readonly materialTextures = new Map<Material, Set<Texture>>();
  private readonly triangulationOverlays = new Map<Mesh, Mesh>();
  private readonly triangulationMaterial = new MeshBasicMaterial({ color: 0x1b1d24, wireframe: true, transparent: true, opacity: 0.72, depthWrite: false });
  private readonly hiddenSurfaceMaterial = new MeshBasicMaterial({ colorWrite: false, depthWrite: false, transparent: true, opacity: 0 });
  private readonly normalMaterials = new Map<boolean, MeshNormalMaterial>();
  private readonly checkerMaterials = new Map<boolean, MeshBasicMaterial>();
  private readonly checkerTexture = createCheckerTexture();
  private readonly originalBackground: Scene["background"];
  private readonly originalAutoUpdate: boolean;
  private readonly modelBounds = new Box3();
  private readonly boundsCenter = new Vector3();
  private readonly boundsSize = new Vector3();
  private readonly keyDirection = new Vector3(0.55, 1, 0.7).normalize();
  private shadowDirty = true;
  private materialsDirty = false;
  private disposed = false;

  constructor(options: ViewportDisplayControllerOptions) {
    this.renderer = options.renderer;
    this.scene = options.scene;
    this.camera = options.camera;
    this.presentationRoot = options.presentationRoot;
    this.grid = options.grid;
    this.getSelectedObjects = options.getSelectedObjects ?? (() => []);
    this.setTopologyEdges = options.setTopologyEdges ?? (() => undefined);
    this.lightingEnabled = options.lightingEnabled !== false;
    this.originalBackground = this.scene.background;
    this.originalAutoUpdate = this.renderer.shadowMap.autoUpdate;

    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;

    this.keyLight.position.set(6, 10, 7);
    this.fillLight.position.set(-7, 4, 3);
    this.rimLight.position.set(1, 6, -8);
    this.keyLight.target.name = "modeling-kit-display-key-target";
    this.lightRig.name = "modeling-kit-display-light-rig";
    this.lightRig.userData.isViewportPresentation = true;
    this.lightRig.add(this.hemisphere, this.keyLight, this.fillLight, this.rimLight, this.keyLight.target);
    this.scene.add(this.lightRig);

    this.floor.name = "modeling-kit-display-floor";
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.receiveShadow = true;
    this.floor.userData.isViewportPresentation = true;
    this.scene.add(this.floor);

    this.checkerTexture.colorSpace = SRGBColorSpace;
    this.checkerTexture.wrapS = RepeatWrapping;
    this.checkerTexture.wrapT = RepeatWrapping;
    this.checkerTexture.repeat.set(8, 8);
    this.checkerTexture.needsUpdate = true;
    this.state = new ViewportRenderState(options.initial);
    this.applySettings();
  }

  get settings(): Readonly<ViewportRenderSettings> { return this.state.settings; }
  get cachedMaterialCount(): number {
    let count = this.normalMaterials.size + this.checkerMaterials.size;
    for (const variants of this.materialCache.values()) count += variants.size;
    return count;
  }
  get shadowNeedsUpdate(): boolean { return this.shadowDirty; }

  setRenderMode(mode: ViewportRenderMode): void {
    this.state.setRenderMode(mode);
    this.applySettings();
  }

  updateRenderSettings(next: ViewportRenderSettingsInput): void {
    this.state.update(next);
    this.applySettings();
  }

  /** Compatibility with the initial display-settings API. */
  setSettings(next: ViewportRenderSettingsInput): void { this.updateRenderSettings(next); }

  resize(width: number, height: number, pixelRatio = 1): void {
    this.state.resize(width, height, pixelRatio);
  }

  invalidateShadows(): void { this.shadowDirty = true; }

  invalidateDerivedMaterials(): void {
    this.materialsDirty = true;
    this.shadowDirty = true;
  }

  render(): void {
    if (this.disposed) return;
    if (this.materialsDirty) this.pruneMaterialCache();
    if (this.shadowDirty) this.updateShadowLayout();
    this.syncMeshShadowFlags();
    this.syncTriangulationOverlays();
    const swaps = this.applyMaterialOverrides();
    const updateShadowMap = this.state.shadowsEnabled() && this.shadowDirty;
    this.renderer.shadowMap.needsUpdate = updateShadowMap;
    try {
      this.renderer.render(this.scene, this.camera);
    } finally {
      for (const { mesh, material } of swaps) mesh.material = material;
      this.renderer.shadowMap.needsUpdate = false;
      if (updateShadowMap) this.shadowDirty = false;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.state.dispose();
    this.lightRig.removeFromParent();
    this.floor.removeFromParent();
    this.floorGeometry.dispose();
    this.floorMaterial.dispose();
    this.triangulationMaterial.dispose();
    this.hiddenSurfaceMaterial.dispose();
    for (const overlay of this.triangulationOverlays.values()) overlay.removeFromParent();
    this.triangulationOverlays.clear();
    this.disposeMaterialCache();
    for (const material of this.normalMaterials.values()) material.dispose();
    for (const material of this.checkerMaterials.values()) material.dispose();
    this.normalMaterials.clear();
    this.checkerMaterials.clear();
    this.checkerTexture.dispose();
    for (const texture of this.ownedTextures) texture.dispose();
    this.ownedTextures.clear();
    this.materialTextures.clear();
    this.keyLight.shadow.map?.dispose();
    this.renderer.shadowMap.autoUpdate = this.originalAutoUpdate;
    this.renderer.shadowMap.needsUpdate = false;
    this.scene.background = this.originalBackground;
  }

  private applySettings(): void {
    const settings = this.state.settings;
    const lit = settings.mode !== "unlit" && settings.mode !== "wireframe" && settings.mode !== "normals" && settings.mode !== "uv-checker";
    this.lightRig.visible = this.lightingEnabled && lit;
    this.renderer.shadowMap.enabled = this.state.shadowsEnabled();
    this.keyLight.castShadow = this.renderer.shadowMap.enabled;
    this.fillLight.castShadow = false;
    this.rimLight.castShadow = false;
    const shadowSize = shadowMapSizeForQuality(settings.shadows);
    if (shadowSize > 0) this.keyLight.shadow.mapSize.set(shadowSize, shadowSize);
    this.keyLight.shadow.radius = Math.max(0, settings.shadowSoftness);
    this.keyLight.shadow.bias = settings.shadowBias;
    this.keyLight.shadow.normalBias = settings.shadowNormalBias;
    this.floor.visible = settings.showGround && modeSupportsShadows(settings.mode);
    if (this.grid) this.grid.visible = settings.showGrid;
    this.setTopologyEdges(this.state.topologyEdgesVisible());
    this.scene.background = new Color(settings.mode === "game-preview" ? 0x273242 : 0x13131c);
    this.applyLightingPreset(settings.mode);
    this.shadowDirty = true;
  }

  private applyLightingPreset(mode: ViewportRenderMode): void {
    if (mode === "game-preview") {
      this.hemisphere.intensity = 0.55;
      this.keyLight.intensity = 3.1;
      this.fillLight.intensity = 0.38;
      this.rimLight.intensity = 0.55;
      this.keyLight.color.set(0xffefd4);
      this.rimLight.color.set(0xb9d2ff);
    } else {
      this.hemisphere.intensity = 0.72;
      this.keyLight.intensity = 2.5;
      this.fillLight.intensity = 0.55;
      this.rimLight.intensity = 0.7;
      this.keyLight.color.set(0xffffff);
      this.rimLight.color.set(0xffe6c8);
    }
  }

  private applyMaterialOverrides(): MaterialSwap[] {
    const swaps: MaterialSwap[] = [];
    this.presentationRoot.traverse((object) => {
      if (!(object instanceof Mesh) || isPresentationObject(object)) return;
      const original = object.material;
      const sources = Array.isArray(original) ? original : [original];
      const replacements = sources.map((source) => this.materialFor(source));
      swaps.push({ mesh: object, material: original });
      object.material = Array.isArray(original) ? replacements : replacements[0]!;
    });
    return swaps;
  }

  private materialFor(source: Material): Material {
    const { mode, flatShading, textureFiltering } = this.state.settings;
    if (mode === "wireframe") return this.hiddenSurfaceMaterial;
    if (mode === "normals") {
      let material = this.normalMaterials.get(flatShading);
      if (!material) {
        material = new MeshNormalMaterial({ flatShading, side: DoubleSide });
        this.normalMaterials.set(flatShading, material);
      }
      return material;
    }
    if (mode === "uv-checker") {
      let material = this.checkerMaterials.get(flatShading);
      if (!material) {
        material = new MeshBasicMaterial({ map: this.checkerTexture, side: DoubleSide });
        this.checkerMaterials.set(flatShading, material);
      }
      this.applyTextureFilter(this.checkerTexture, textureFiltering);
      return material;
    }
    const cacheKey = `${mode}:${flatShading ? 1 : 0}:${textureFiltering}`;
    let variants = this.materialCache.get(source);
    if (!variants) {
      variants = new Map();
      this.materialCache.set(source, variants);
    }
    const cached = variants.get(cacheKey);
    if (cached) return cached;
    const material = this.createMaterialVariant(source, mode, flatShading, textureFiltering);
    variants.set(cacheKey, material);
    return material;
  }

  private createMaterialVariant(
    source: Material,
    mode: ViewportRenderMode,
    flatShading: boolean,
    filtering: ViewportRenderSettings["textureFiltering"],
  ): Material {
    if (mode === "solid") {
      return new MeshStandardMaterial({ color: 0x7f8da3, roughness: 0.76, metalness: 0, flatShading, side: DoubleSide });
    }
    if (mode === "unlit") {
      const standard = source as MeshStandardMaterial;
      const material = new MeshBasicMaterial({
        color: standard.color?.clone() ?? new Color(0xabb2bf),
        transparent: source.transparent,
        opacity: source.opacity,
        alphaTest: source.alphaTest,
        side: source.side,
      });
      if (standard.map) material.map = this.cloneTexture(standard.map, filtering, material);
      if (standard.alphaMap) material.alphaMap = this.cloneTexture(standard.alphaMap, filtering, material);
      return material;
    }
    const material = source.clone();
    const typed = material as Material & { flatShading?: boolean; needsUpdate: boolean };
    if ("flatShading" in typed) typed.flatShading = flatShading;
    const useTextures = mode === "textured" || mode === "game-preview";
    for (const slot of TEXTURE_SLOTS) {
      const textured = material as unknown as Record<string, unknown>;
      const value = textured[slot] as Texture | null | undefined;
      if (value) textured[slot] = useTextures ? this.cloneTexture(value, filtering, material) : null;
    }
    typed.needsUpdate = true;
    return material;
  }

  private cloneTexture(source: Texture, filtering: ViewportRenderSettings["textureFiltering"], owner: Material): Texture {
    const texture = source.clone();
    this.applyTextureFilter(texture, filtering);
    texture.needsUpdate = true;
    this.ownedTextures.add(texture);
    let owned = this.materialTextures.get(owner);
    if (!owned) {
      owned = new Set();
      this.materialTextures.set(owner, owned);
    }
    owned.add(texture);
    return texture;
  }

  private applyTextureFilter(texture: Texture, filtering: ViewportRenderSettings["textureFiltering"]): void {
    const filter = filtering === "nearest" ? NearestFilter : LinearFilter;
    texture.magFilter = filter;
    texture.minFilter = filter;
    texture.needsUpdate = true;
  }

  private syncTriangulationOverlays(): void {
    const show = this.state.settings.showTriangulation;
    const live = new Set<Mesh>();
    this.presentationRoot.traverse((object) => {
      if (!(object instanceof Mesh) || isPresentationObject(object)) return;
      live.add(object);
      let overlay = this.triangulationOverlays.get(object);
      if (!overlay) {
        overlay = new Mesh(object.geometry, this.triangulationMaterial);
        overlay.name = "modeling-kit-triangulation-overlay";
        overlay.userData.isViewportPresentation = true;
        overlay.renderOrder = 20;
        object.add(overlay);
        this.triangulationOverlays.set(object, overlay);
      }
      overlay.geometry = object.geometry;
      overlay.visible = show;
    });
    for (const [mesh, overlay] of this.triangulationOverlays) {
      if (live.has(mesh)) continue;
      overlay.removeFromParent();
      this.triangulationOverlays.delete(mesh);
    }
  }

  private syncMeshShadowFlags(): void {
    const enabled = this.renderer.shadowMap.enabled;
    this.presentationRoot.traverse((object) => {
      if (!(object instanceof Mesh) || isPresentationObject(object)) return;
      object.castShadow = enabled;
      object.receiveShadow = enabled;
    });
  }

  private updateShadowLayout(): void {
    if (!this.state.shadowsEnabled() && !this.floor.visible) return;
    this.modelBounds.makeEmpty();
    const selected = this.getSelectedObjects().filter((object) => object.visible);
    const roots = selected.length > 0 ? selected : [this.presentationRoot];
    for (const root of roots) {
      root.updateWorldMatrix(true, true);
      root.traverse((object) => {
        if (!(object instanceof Mesh) || isPresentationObject(object) || !object.visible) return;
        this.modelBounds.expandByObject(object, false);
      });
    }
    if (this.modelBounds.isEmpty()) return;
    this.modelBounds.getCenter(this.boundsCenter);
    this.modelBounds.getSize(this.boundsSize);
    const radius = Math.max(0.5, this.boundsSize.length() * 0.5);
    const requestedExtent = radius * 1.35;
    const extent = Math.min(requestedExtent, Math.max(1, this.state.settings.maxShadowFitSize * 0.5));
    const floorSize = Math.max(20, Math.min(this.state.settings.maxShadowFitSize, extent * 4));
    this.floor.position.set(this.boundsCenter.x, this.modelBounds.min.y - Math.max(0.002, radius * 0.002), this.boundsCenter.z);
    this.floor.scale.set(floorSize, floorSize, 1);
    this.keyLight.target.position.copy(this.boundsCenter);
    this.keyLight.position.copy(this.boundsCenter).addScaledVector(this.keyDirection, radius * 4.5);
    const shadowCamera = this.keyLight.shadow.camera;
    shadowCamera.left = -extent;
    shadowCamera.right = extent;
    shadowCamera.top = extent;
    shadowCamera.bottom = -extent;
    shadowCamera.near = Math.max(0.05, radius * 0.05);
    shadowCamera.far = Math.max(20, radius * 10);
    shadowCamera.updateProjectionMatrix();
    this.keyLight.target.updateMatrixWorld();
  }

  private pruneMaterialCache(): void {
    this.materialsDirty = false;
    const live = new Set<Material>();
    this.presentationRoot.traverse((object) => {
      if (!(object instanceof Mesh) || isPresentationObject(object)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) live.add(material);
    });
    for (const [source, variants] of this.materialCache) {
      if (live.has(source)) continue;
      for (const material of variants.values()) this.disposeMaterialVariant(material);
      variants.clear();
      this.materialCache.delete(source);
    }
  }

  private disposeMaterialCache(): void {
    for (const variants of this.materialCache.values()) {
      for (const material of variants.values()) this.disposeMaterialVariant(material);
      variants.clear();
    }
    this.materialCache.clear();
  }

  private disposeMaterialVariant(material: Material): void {
    const textures = this.materialTextures.get(material);
    if (textures) {
      for (const texture of textures) {
        texture.dispose();
        this.ownedTextures.delete(texture);
      }
      this.materialTextures.delete(material);
    }
    material.dispose();
  }
}

function isPresentationObject(object: Object3D): boolean {
  return object.userData.isOverlay === true || object.userData.isViewportPresentation === true;
}

function createCheckerTexture(): DataTexture {
  const size = 64;
  const cells = 8;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const checker = ((Math.floor(x / cells) + Math.floor(y / cells)) & 1) === 0;
      const value = checker ? 218 : 72;
      const offset = (y * size + x) * 4;
      data[offset] = value;
      data[offset + 1] = checker ? 218 : 82;
      data[offset + 2] = checker ? 218 : 108;
      data[offset + 3] = 255;
    }
  }
  return new DataTexture(data, size, size, RGBAFormat, UnsignedByteType);
}
