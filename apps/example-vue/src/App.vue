<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import {
  createModelingSession,
  CreatePrimitiveCommand,
  ExtrudeFacesCommand,
  type ModelingSession,
} from '@modeling-kit/sdk';
import { ThreeViewportAdapter } from '@modeling-kit/three-adapter';
import * as THREE from 'three';

const containerRef = ref<HTMLDivElement | null>(null);
const faceCount = ref(6);
const canUndo = ref(false);
const canRedo = ref(false);

let session: ModelingSession | null = null;
let adapter: ThreeViewportAdapter | null = null;
let cubeInfo: any = null;

function updateStats() {
  if (!session || !cubeInfo) return;
  const mesh = session.meshes.get(cubeInfo.meshId);
  if (mesh) {
    faceCount.value = mesh.faces.size;
  }
  canUndo.value = session.canUndo;
  canRedo.value = session.canRedo;
}

onMounted(() => {
  if (!containerRef.value) return;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x181824);

  const ambient = new THREE.AmbientLight(0xffffff, 0.7);
  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(5, 10, 7);
  scene.add(ambient, dir);

  const grid = new THREE.GridHelper(10, 10, 0x444455, 0x2a2a38);
  scene.add(grid);

  const width = containerRef.value.clientWidth || window.innerWidth;
  const height = containerRef.value.clientHeight || window.innerHeight;
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
  camera.position.set(4, 4, 6);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  containerRef.value.appendChild(renderer.domElement);

  session = createModelingSession();
  cubeInfo = session.execute(
    new CreatePrimitiveCommand('cube', { width: 2, height: 2, depth: 2 })
  );

  adapter = new ThreeViewportAdapter({
    session,
    scene,
    camera,
    renderer,
  });
  adapter.mount();

  const handleResize = () => {
    if (!containerRef.value) return;
    const w = containerRef.value.clientWidth;
    const h = containerRef.value.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  window.addEventListener('resize', handleResize);

  let reqId: number;
  const animate = () => {
    reqId = requestAnimationFrame(animate);
    renderer.render(scene, camera);
  };
  animate();

  updateStats();

  onUnmounted(() => {
    cancelAnimationFrame(reqId);
    window.removeEventListener('resize', handleResize);
    adapter?.dispose();
    renderer.dispose();
    if (renderer.domElement.parentElement) {
      renderer.domElement.parentElement.removeChild(renderer.domElement);
    }
  });
});

function handleExtrude() {
  if (!session || !cubeInfo) return;
  session.selection.replace({
    domain: 'face',
    objectId: cubeInfo.objectId,
    elementIds: [cubeInfo.faceIds.top],
  });
  session.execute(new ExtrudeFacesCommand({ distance: 0.5 }));
  updateStats();
}

function handleUndo() {
  session?.undo();
  updateStats();
}

function handleRedo() {
  session?.redo();
  updateStats();
}
</script>

<template>
  <div class="app-container">
    <header class="app-header">
      <div class="brand">
        <span class="logo">Vue</span>
        <h1>@modeling-kit/example-vue</h1>
      </div>
      <div class="controls">
        <button @click="handleExtrude">Extrude Top Face</button>
        <button @click="handleUndo" :disabled="!canUndo">Undo</button>
        <button @click="handleRedo" :disabled="!canRedo">Redo</button>
      </div>
      <div class="stats">
        <span>Faces: <strong>{{ faceCount }}</strong></span>
      </div>
    </header>
    <main ref="containerRef" class="viewport"></main>
  </div>
</template>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background-color: #121218;
  color: #eee;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  overflow: hidden;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  background-color: #1a1a24;
  border-bottom: 1px solid #2e2e3e;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo {
  background: #42b883;
  color: #0d1117;
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: 700;
  font-size: 12px;
}

h1 {
  font-size: 16px;
  margin: 0;
  font-weight: 600;
}

.controls {
  display: flex;
  gap: 8px;
}

button {
  background: #2b2b3b;
  border: 1px solid #44445c;
  color: #fff;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

button:hover:not(:disabled) {
  background: #38384d;
  border-color: #606080;
}

button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.stats {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: #9090aa;
}

.stats strong {
  color: #fff;
}

.viewport {
  flex: 1;
  width: 100%;
  position: relative;
}
</style>
