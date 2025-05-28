// Type declarations for Hyperfy core modules

declare module '../hyperfy/src/core/systems/System.js' {
  export class System {
    world: {
      entities?: {
        player?: {
          base: {
            position: import('three').Vector3;
            quaternion: import('three').Quaternion;
          };
          cam: {
            rotation: import('three').Euler;
          };
        };
      };
      rig?: {
        position: import('three').Vector3;
        quaternion: import('three').Quaternion;
        rotation: import('three').Euler;
      };
      camera?: {
        position?: {
          z: number;
        };
      };
    };
    constructor(world: unknown);
  }
}

declare module '../hyperfy/src/core/extras/Vector3Enhanced.js' {
  import * as THREE from 'three';
  
  export class Vector3Enhanced extends THREE.Vector3 {
    constructor(x?: number, y?: number, z?: number);
    // Add any additional properties/methods specific to Vector3Enhanced if needed
    isVector3: boolean;
  }
} 