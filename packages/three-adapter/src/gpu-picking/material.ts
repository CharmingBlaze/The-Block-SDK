import {
  DoubleSide,
  FrontSide,
  NoBlending,
  ShaderMaterial,
  Vector4,
  type Side,
} from "three";
import { pickIdToUnitRgb } from "./encode";
import type { PickBackfaceMode } from "@modeling-kit/selection";

const OBJECT_VERTEX = /* glsl */ `
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const OBJECT_FRAGMENT = /* glsl */ `
uniform vec4 pickColor;
void main() {
  gl_FragColor = pickColor;
}
`;

const FACE_VERTEX = /* glsl */ `
attribute vec3 pickColor;
varying vec3 vPickColor;
void main() {
  vPickColor = pickColor;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FACE_FRAGMENT = /* glsl */ `
varying vec3 vPickColor;
void main() {
  gl_FragColor = vec4(vPickColor, 1.0);
}
`;

function pickSide(mode: PickBackfaceMode): Side {
  return mode === "front-and-back" ? DoubleSide : FrontSide;
}

function pickingFlags(side: Side): ConstructorParameters<typeof ShaderMaterial>[0] {
  return {
    toneMapped: false,
    fog: false,
    lights: false,
    blending: NoBlending,
    transparent: false,
    depthTest: true,
    depthWrite: true,
    dithering: false,
    side,
  };
}

export function createObjectPickingMaterial(pickId: number, backfaceMode: PickBackfaceMode): ShaderMaterial {
  const rgb = pickIdToUnitRgb(pickId);
  return new ShaderMaterial({
    uniforms: {
      pickColor: { value: new Vector4(rgb.r, rgb.g, rgb.b, 1) },
    },
    vertexShader: OBJECT_VERTEX,
    fragmentShader: OBJECT_FRAGMENT,
    ...pickingFlags(pickSide(backfaceMode)),
  });
}

export function createFacePickingMaterial(backfaceMode: PickBackfaceMode): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: FACE_VERTEX,
    fragmentShader: FACE_FRAGMENT,
    ...pickingFlags(pickSide(backfaceMode)),
  });
}

export function setObjectPickColor(material: ShaderMaterial, pickId: number): void {
  const rgb = pickIdToUnitRgb(pickId);
  const value = material.uniforms.pickColor?.value as Vector4 | undefined;
  if (value) {
    value.set(rgb.r, rgb.g, rgb.b, 1);
  }
}
