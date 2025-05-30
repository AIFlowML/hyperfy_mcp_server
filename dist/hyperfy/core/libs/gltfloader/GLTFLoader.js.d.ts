import type { Loader } from 'three';

interface GLTFResult {
  scene: THREE.Group;
  scenes: THREE.Group[];
  animations: THREE.AnimationClip[];
  cameras: THREE.Camera[];
  asset: Record<string, unknown>;
  parser: unknown;
  userData: Record<string, unknown>;
}

export class GLTFLoader extends Loader {
  constructor(manager?: THREE.LoadingManager);
  
  load(
    url: string,
    onLoad: (gltf: GLTFResult) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (event: ErrorEvent) => void
  ): void;
  
  parse(
    data: ArrayBuffer | string,
    path: string,
    onLoad: (gltf: GLTFResult) => void,
    onError?: (event: ErrorEvent) => void
  ): void;
  
  parseAsync(data: ArrayBuffer | string, path: string): Promise<GLTFResult>;
  
  setDRACOLoader(dracoLoader: unknown): GLTFLoader;
  setKTX2Loader(ktx2Loader: unknown): GLTFLoader;
  setMeshoptDecoder(meshoptDecoder: unknown): GLTFLoader;
  register(callback: (parser: unknown) => unknown): GLTFLoader;
  unregister(callback: (parser: unknown) => unknown): GLTFLoader;
} 