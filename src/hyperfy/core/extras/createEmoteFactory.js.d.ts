import type * as THREE from 'three';

interface EmoteFactory {
  toClip(options: {
    rootToHips: number;
    version: string;
    getBoneName: (vrmBoneName: string) => string | undefined;
  }): THREE.AnimationClip;
}

interface GLBEmoteData {
  animations: THREE.AnimationClip[];
  scene: THREE.Scene;
}

export function createEmoteFactory(glb: GLBEmoteData, url: string): EmoteFactory; 