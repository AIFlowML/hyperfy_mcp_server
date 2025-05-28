import type * as THREE from 'three';

interface VRMInstance {
  raw: unknown;
  height: number;
  headToHeight: number;
  setEmote: (url: string) => void;
  setFirstPerson: (active: boolean) => void;
  update: (delta: number) => void;
  getBoneTransform: (boneName: string) => THREE.Matrix4 | null;
  move: (matrix: THREE.Matrix4) => void;
  destroy: () => void;
}

interface VRMFactory {
  create(matrix: THREE.Matrix4, hooks: unknown, node: unknown): VRMInstance;
  applyStats(stats: unknown): void;
}

export function createVRMFactory(glb: unknown, setupMaterial: (material: THREE.Material) => void): VRMFactory; 