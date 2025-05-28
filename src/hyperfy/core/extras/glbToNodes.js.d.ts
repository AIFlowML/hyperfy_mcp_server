import type { Node } from '../nodes/Node.js.js';

interface GLBData {
  scene: THREE.Scene;
  animations: THREE.AnimationClip[];
}

export function glbToNodes(glb: GLBData, world: unknown): Node; 