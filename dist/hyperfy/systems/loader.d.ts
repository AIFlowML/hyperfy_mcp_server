import * as THREE from "three";
import { System } from "../core/systems/System.js";
import { GLTFLoader } from "../core/libs/gltfloader/GLTFLoader.js";
interface LoadedResult {
    gltf?: unknown;
    toNodes?: () => unknown;
    toClip?: (options: unknown) => THREE.AnimationClip;
    factory?: unknown;
}
export declare class AgentLoader extends System {
    promises: Map<string, Promise<LoadedResult | undefined>>;
    results: Map<string, LoadedResult>;
    gltfLoader: GLTFLoader;
    dummyScene: THREE.Object3D;
    constructor(world: unknown);
    preload(type: string, url: string): void;
    execPreload(): void;
    has(type: string, url: string): boolean;
    get(type: string, url: string): LoadedResult | undefined;
    resolveUrl(url: string): string | null;
    load(type: string, url: string): Promise<LoadedResult | undefined>;
    parseGLB(type: string, key: string, arrayBuffer: ArrayBuffer, url: string): Promise<LoadedResult>;
}
export {};
//# sourceMappingURL=loader.d.ts.map