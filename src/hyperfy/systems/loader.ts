import * as THREE from "three";
import { System } from "../core/systems/System.js";
import { createVRMFactory } from "../core/extras/createVRMFactory.js";
import { createNode } from "../core/extras/createNode.js";
import { GLTFLoader } from "../core/libs/gltfloader/GLTFLoader.js";
import { glbToNodes } from "../core/extras/glbToNodes.js";
import { createEmoteFactory } from "../core/extras/createEmoteFactory.js";
import { AgentAvatar } from "./avatar.js";
import type { 
  GLBData, 
  GLBEmoteData, 
  VRMFactory, 
  AvatarFactory, 
  EmoteFactory,
  EmoteClipOptions 
} from "../../types/index.js";
// import { VRMLoaderPlugin } from "@pixiv/three-vrm";
// --- Mock Browser Environment for Loaders ---
// These might need adjustment based on GLTFLoader/VRMLoaderPlugin requirements
if (typeof globalThis !== "undefined") {
  // Mock URL if not globally available or needs specific behavior
  // globalThis.URL = URL; // Usually available in modern Node

  // Mock self if needed by any dependency
  // globalThis.self = globalThis;

  // Mock window minimally
  globalThis.window = globalThis.window || globalThis;

  // Mock document minimally for GLTFLoader
  globalThis.document = globalThis.document || {
    createElementNS: (ns: string, type: string) => {
      if (type === "img") {
        // Basic mock for image elements if texture loading is attempted (though we aim to bypass it)
        return {
          src: "",
          onload: () => {},
          onerror: () => {},
        };
      }
      // Default mock for other elements like canvas
      return { style: {} };
    },
    createElement: (type: string) => {
      if (type === "img") {
        return { src: "", onload: () => {}, onerror: () => {} };
      }
      // Basic canvas mock if needed
      if (type === "canvas") {
        return { getContext: () => null, style: {} };
      }
      return { style: {} }; // Default
    },
    // Add more document mocks if loader errors indicate they are needed
  };

  // Polyfill fetch if using older Node version without native fetch
  // globalThis.fetch = fetch;
}
// --- End Mocks ---

interface LoaderCacheKey {
  type: string;
  url: string;
}

interface LoadedResult {
  gltf?: unknown;
  toNodes?: () => unknown;
  toClip?: (options: unknown) => THREE.AnimationClip;
  factory?: unknown;
}

interface WorldWithProperties {
  assetsUrl?: string;
  scripts?: {
    evaluate: (code: string) => unknown;
  };
}

export class AgentLoader extends System {
  promises: Map<string, Promise<LoadedResult | undefined>>;
  results: Map<string, LoadedResult>;
  gltfLoader: GLTFLoader;
  dummyScene: THREE.Object3D;
  constructor(world: unknown) {
    super(world);
    this.promises = new Map();
    this.results = new Map();
    this.gltfLoader = new GLTFLoader();

    // --- Dummy Scene for Hooks ---
    // Create one dummy object to act as the scene target for all avatar loads
    this.dummyScene = new THREE.Object3D();
    this.dummyScene.name = "AgentLoaderDummyScene";
    // -----------------------------

    // --- Attempt to register VRM plugin ---
    // try {
    //     this.gltfLoader.register(parser => new VRMLoaderPlugin(parser, {
    //         autoUpdateHumanBones: false
    //     }));
    //     console.log("[AgentLoader] VRMLoaderPlugin registered.");
    // } catch (vrmError) {
    //     console.error("[AgentLoader] Warning: Failed to register VRMLoaderPlugin. VRM-specific features might be unavailable.", vrmError);
    // }
    // ---------------------------------------
  }

  // --- Dummy Preload Methods ---
  preload(type: string, url: string): void {
    // No-op for agent
  }
  execPreload(): void {
    // No-op for agent
    // ClientNetwork calls this after snapshot, so it must exist.
    console.log("[AgentLoader] execPreload called (No-op).");
  }
  // ---------------------------

  // --- Basic Cache Handling ---
  // ... (has, get methods remain the same) ...
  has(type: string, url: string): boolean {
    const key = `${type}/${url}`;
    return this.results.has(key) || this.promises.has(key);
  }
  get(type: string, url: string): LoadedResult | undefined {
    const key = `${type}/${url}`;
    return this.results.get(key);
  }
  // ---------------------------

  resolveUrl(url: string): string | null {
    if (typeof url !== "string") {
      console.error(`[AgentLoader] Invalid URL type provided: ${typeof url}`);
      return null;
    }
    if (url.startsWith("asset://")) {
      const worldProps = this.world as WorldWithProperties;
      if (!worldProps.assetsUrl) {
        console.error(
          "[AgentLoader] Cannot resolve asset:// URL, world.assetsUrl not set."
        );
        return null;
      }
      const filename = url.substring("asset://".length);
      const baseUrl = worldProps.assetsUrl.replace(/[/\\\\]$/, ""); // Remove trailing slash (either / or \)
      return `${baseUrl}/${filename}`;
    }
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }
    console.warn(
      `[AgentLoader] Cannot resolve potentially relative URL without base: ${url}`
    );
    return url;
  }

  async load(type: string, url: string): Promise<LoadedResult | undefined> {
    const key = `${type}/${url}`;
    if (this.promises.has(key)) return this.promises.get(key);

    const resolved = this.resolveUrl(url);
    if (resolved === null) {
      throw new Error(`[AgentLoader] Could not resolve URL: ${url}`);
    }

    const promise = fetch(resolved)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            `[AgentLoader] HTTP error ${response.status} for ${resolved}`
          );
        }

        if (type === "model" || type === "avatar" || type === "emote") {
          const arrayBuffer = await response.arrayBuffer();
          return this.parseGLB(type, key, arrayBuffer, resolved);
        }

        // TEMP WORKAROUND: Only load scripts that do not create video, UI, or image elements.
        // TODO: Replace this with a proper script validation system.
        if (type === 'script') {
          const code = await response.text();

          const forbiddenTypes = ['video', 'ui', 'image'];
          const isForbidden = forbiddenTypes.some(type =>
            new RegExp(`app\\.create\\s*\\(\\s*['"]${type}['"]\\s*(,|\\))`).test(code)
          );

          if (isForbidden) {
            console.warn('[ScriptLoader] Skipping script: disallowed type used');
            return;
          }

          const worldProps = this.world as WorldWithProperties;
          const script = worldProps.scripts?.evaluate(code);
          this.results.set(key, script as LoadedResult);
          return script as LoadedResult;
        }

        
        console.warn(`[AgentLoader] Unsupported type in load(): ${type}`);
        return undefined;
      })
      .catch((error) => {
        this.promises.delete(key);
        console.error(
          `[AgentLoader] Failed to load ${type} from ${resolved}`,
          error
        );
        throw error;
      });

    this.promises.set(key, promise);
    return promise;
  }

  parseGLB(type: string, key: string, arrayBuffer: ArrayBuffer, url: string): Promise<LoadedResult> {
    return new Promise((resolve, reject) => {
      this.gltfLoader.parse(
        arrayBuffer,
        "",
        (gltf: unknown) => {
          let result: LoadedResult;

          if (type === "model") {
            const node = glbToNodes(gltf as GLBData, this.world);
            result = {
              gltf,
              toNodes() {
                return node.clone(true);
              },
            };
          } else if (type === "emote") {
            const factory = createEmoteFactory(gltf as GLBEmoteData, url);
            result = {
              gltf,
              toClip(options: unknown) {
                const clipOptions = options as EmoteClipOptions;
                return factory.toClip(clipOptions);
              },
            };
          } else if (type === "avatar") {
            // Use world.setupMaterial if available, otherwise provide a default
            const worldProps = this.world as WorldWithProperties & { setupMaterial?: (material: THREE.Material) => void };
            const setupMaterial = worldProps.setupMaterial || ((material: THREE.Material) => {
              // Default material setup - minimal implementation
            });
            
            const factory: VRMFactory | null = (gltf as { userData?: { vrm?: unknown } }).userData?.vrm 
              ? createVRMFactory(gltf, setupMaterial) 
              : null;

            const rootNode = createNode("group", { id: "$root" });
            const avatarNode = new AgentAvatar({ 
              id: "avatar", 
              factory: factory as AvatarFactory | undefined 
            });
            rootNode.add(avatarNode);

            result = {
              gltf,
              factory,
              toNodes() {
                return rootNode.clone(true);
              },
            };
          } else {
            return reject(
              new Error(`[AgentLoader] Unsupported GLTF type: ${type}`)
            );
          }

          this.results.set(key, result);
          resolve(result);
        },
        (error: unknown) => {
          reject(error);
        }
      );
    });
  }
}
