import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  createModelingSession,
  CreatePrimitiveCommand,
  ExtrudeFacesCommand,
  type ModelingSession,
  type CreatePrimitiveResult,
} from '@modeling-kit/sdk';
import { ThreeViewportAdapter } from '@modeling-kit/three-adapter';

export function App() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef<ModelingSession | null>(null);
  const adapterRef = useRef<ThreeViewportAdapter | null>(null);
  const cubeInfoRef = useRef<CreatePrimitiveResult | null>(null);
  const [faceCount, setFaceCount] = useState(6);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x181824);

    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(5, 10, 7);
    scene.add(ambient, dir);

    const grid = new THREE.GridHelper(10, 10, 0x444455, 0x2a2a38);
    scene.add(grid);

    const width = containerRef.current.clientWidth || window.innerWidth;
    const height = containerRef.current.clientHeight || window.innerHeight;
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(4, 4, 6);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    containerRef.current.appendChild(renderer.domElement);

    const session = createModelingSession();
    sessionRef.current = session;

    const cube = session.execute(
      new CreatePrimitiveCommand('cube', { width: 2, height: 2, depth: 2 })
    );
    cubeInfoRef.current = cube;

    const adapter = new ThreeViewportAdapter({
      session,
      scene,
      camera,
      renderer,
    });
    adapterRef.current = adapter;
    adapter.mount();

    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
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

    return () => {
      cancelAnimationFrame(reqId);
      window.removeEventListener('resize', handleResize);
      adapter.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
    };
  }, []);

  const updateStats = () => {
    const session = sessionRef.current;
    const cube = cubeInfoRef.current;
    if (!session || !cube) return;
    const mesh = session.meshes.get(cube.meshId);
    if (mesh) {
      setFaceCount(mesh.faces.size);
    }
    setCanUndo(session.canUndo);
    setCanRedo(session.canRedo);
  };

  const handleExtrude = () => {
    const session = sessionRef.current;
    const cube = cubeInfoRef.current;
    if (!session || !cube) return;

    session.selection.replace({
      domain: 'face',
      objectId: cube.objectId,
      elementIds: [cube.faceIds.top],
    });
    session.execute(new ExtrudeFacesCommand({ distance: 0.5 }));
    updateStats();
  };

  const handleUndo = () => {
    sessionRef.current?.undo();
    updateStats();
  };

  const handleRedo = () => {
    sessionRef.current?.redo();
    updateStats();
  };

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#121218', color: '#eee', fontFamily: 'sans-serif', overflow: 'hidden' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', backgroundColor: '#1a1a24', borderBottom: '1px solid #2e2e3e' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ background: '#61dafb', color: '#0d1117', padding: '4px 8px', borderRadius: 4, fontWeight: 700, fontSize: 12 }}>React</span>
          <h1 style={{ fontSize: 16, margin: 0, fontWeight: 600 }}>@modeling-kit/example-react</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleExtrude} style={{ background: '#2b2b3b', border: '1px solid #44445c', color: '#fff', padding: '6px 14px', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>Extrude Top Face</button>
          <button onClick={handleUndo} disabled={!canUndo} style={{ background: '#2b2b3b', border: '1px solid #44445c', color: '#fff', padding: '6px 14px', borderRadius: 6, fontSize: 13, cursor: canUndo ? 'pointer' : 'not-allowed', opacity: canUndo ? 1 : 0.4 }}>Undo</button>
          <button onClick={handleRedo} disabled={!canRedo} style={{ background: '#2b2b3b', border: '1px solid #44445c', color: '#fff', padding: '6px 14px', borderRadius: 6, fontSize: 13, cursor: canRedo ? 'pointer' : 'not-allowed', opacity: canRedo ? 1 : 0.4 }}>Redo</button>
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#9090aa' }}>
          <span>Faces: <strong style={{ color: '#fff' }}>{faceCount}</strong></span>
        </div>
      </header>
      <div ref={containerRef} style={{ flex: 1, width: '100%', position: 'relative' }} />
    </div>
  );
}
