/**
 * Comprehensive test suite for AgentLoader system
 * Tests GLB parsing, asset loading, avatar creation, and error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { AgentLoader } from '../src/hyperfy/systems/loader.js';
import { GLTFLoader } from '../src/hyperfy/core/libs/gltfloader/GLTFLoader.js';

// Mock fetch globally
global.fetch = vi.fn();

// Mock world object for testing
const createMockWorld = () => ({
  assetsUrl: 'https://test-assets.hyperfy.com',
  scripts: {
    evaluate: vi.fn((code: string) => {
      // Simple script evaluation mock
      return { code, evaluated: true };
    })
  }
});

// Mock GLB data for testing
const createMockGLBData = (type: 'avatar' | 'emote' | 'model' = 'model') => {
  const baseScene = new THREE.Scene();
  baseScene.add(new THREE.Mesh()); // Add a child to scene for scale.x access

  const commonData = {
    scene: baseScene,
    animations: [new THREE.AnimationClip('test-clip', 1, [])],
    userData: {},
  };

  if (type === 'avatar') {
    return {
      ...commonData,
      userData: {
        vrm: {
          humanoid: {
            _rawHumanBones: { // Corrected structure based on createVRMFactory
              humanBones: {
                hips: { node: { matrixWorld: new THREE.Matrix4() } },
                // Add other bones if their matrixWorld is accessed directly
              }
            },
            getRawBoneNode: vi.fn((boneName: string) => ({ 
              name: `vrm-bone-${boneName}`,
              matrixWorld: new THREE.Matrix4(), // Mock matrixWorld for bones
            })),
            // Mock other humanoid properties if accessed
            _normalizedHumanBones: { // For pose arms down
              humanBones: {
                leftUpperArm: { node: new THREE.Object3D() },
                rightUpperArm: { node: new THREE.Object3D() },
                head: { node: new THREE.Object3D() },
              }
            },
            update: vi.fn(), // Mock update method
          },
          meta: {
            metaVersion: '1.0',
          },
        },
      },
    };
  }

  if (type === 'emote') {
    return {
      ...commonData,
      // Emotes might not need vrm specific data in the mock for factory creation,
      // but ensure scene has a child for scale access in createEmoteFactory
    };
  }

  // Default to model
  return commonData;
};

// Mock fetch response with GLB data
const createMockFetchResponse = (arrayBuffer: ArrayBuffer) => {
  const mockResponse = {
    ok: true,
    status: 200,
    arrayBuffer: vi.fn().mockResolvedValue(arrayBuffer),
    text: vi.fn().mockResolvedValue('console.log("test script");')
  } as unknown as Response;
  
  return Promise.resolve(mockResponse);
};

describe('AgentLoader System', () => {
  let loader: AgentLoader;
  let mockWorld: ReturnType<typeof createMockWorld>;
  let mockGLBData: ReturnType<typeof createMockGLBData>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockWorld = createMockWorld();
    mockGLBData = createMockGLBData();
    loader = new AgentLoader(mockWorld);

    // Mock GLTFLoader.parse method
    vi.spyOn(loader.gltfLoader, 'parse').mockImplementation(
      (arrayBuffer: ArrayBuffer, path: string, onLoad: (gltf: unknown) => void, onError?: (error: any) => void) => {
        // Simulate successful parsing
        // The actual GLB data passed here will depend on the test context
        // For now, let's assume a generic model mock if not specified
        const currentMockType = (globalThis as any).__currentMockGlbType || 'model';
        setTimeout(() => onLoad(createMockGLBData(currentMockType)), 10); 
      }
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with correct properties', () => {
      expect(loader).toBeInstanceOf(AgentLoader);
      expect(loader.promises).toBeInstanceOf(Map);
      expect(loader.results).toBeInstanceOf(Map);
      expect(loader.gltfLoader).toBeInstanceOf(GLTFLoader);
      expect(loader.dummyScene).toBeInstanceOf(THREE.Object3D);
      expect(loader.dummyScene.name).toBe('AgentLoaderDummyScene');
    });

    it('should have empty promises and results initially', () => {
      expect(loader.promises.size).toBe(0);
      expect(loader.results.size).toBe(0);
    });
  });

  describe('Cache Management', () => {
    it('should correctly identify cached items', () => {
      expect(loader.has('model', 'test.glb')).toBe(false);
      
      loader.results.set('model/test.glb', { gltf: mockGLBData });
      expect(loader.has('model', 'test.glb')).toBe(true);
    });

    it('should retrieve cached items', () => {
      const testResult = { gltf: mockGLBData };
      loader.results.set('model/test.glb', testResult);
      
      expect(loader.get('model', 'test.glb')).toBe(testResult);
      expect(loader.get('model', 'nonexistent.glb')).toBeUndefined();
    });
  });

  describe('URL Resolution', () => {
    it('should resolve asset:// URLs correctly', () => {
      const resolved = loader.resolveUrl('asset://model.glb');
      expect(resolved).toBe('https://test-assets.hyperfy.com/model.glb');
    });

    it('should handle asset URLs with trailing slashes', () => {
      mockWorld.assetsUrl = 'https://test-assets.hyperfy.com/';
      const resolved = loader.resolveUrl('asset://model.glb');
      expect(resolved).toBe('https://test-assets.hyperfy.com/model.glb');
    });

    it('should pass through HTTP URLs unchanged', () => {
      const httpUrl = 'https://example.com/model.glb';
      expect(loader.resolveUrl(httpUrl)).toBe(httpUrl);
    });

    it('should return null for asset URLs without assetsUrl', () => {
      mockWorld.assetsUrl = undefined;
      const resolved = loader.resolveUrl('asset://model.glb');
      expect(resolved).toBeNull();
    });

    it('should handle invalid URL types', () => {
      const resolved = loader.resolveUrl(123 as unknown as string);
      expect(resolved).toBeNull();
    });
  });

  describe('Asset Loading', () => {
    beforeEach(() => {
      const mockArrayBuffer = new ArrayBuffer(1024);
      (global.fetch as any).mockImplementation(() => 
        createMockFetchResponse(mockArrayBuffer)
      );
      // Reset mock type for GLB parsing
      (globalThis as any).__currentMockGlbType = 'model';
    });

    it('should load model assets successfully', async () => {
      (globalThis as any).__currentMockGlbType = 'model';
      const result = await loader.load('model', 'asset://test-model.glb');
      
      expect(result).toBeDefined();
      expect(result?.gltf).toBeDefined();
      expect(result?.toNodes).toBeInstanceOf(Function);
      expect(global.fetch).toHaveBeenCalledWith('https://test-assets.hyperfy.com/test-model.glb');
    });

    it('should load emote assets successfully', async () => {
      (globalThis as any).__currentMockGlbType = 'emote';
      const result = await loader.load('emote', 'asset://test-emote.glb');
      
      expect(result).toBeDefined();
      expect(result?.gltf).toBeDefined();
      expect(result?.toClip).toBeInstanceOf(Function);
    });

    it('should load avatar assets successfully', async () => {
      (globalThis as any).__currentMockGlbType = 'avatar';
      const result = await loader.load('avatar', 'asset://test-avatar.glb');
      
      expect(result).toBeDefined();
      expect(result?.gltf).toBeDefined();
      expect(result?.factory).toBeDefined();
      expect(result?.toNodes).toBeInstanceOf(Function);
    });

    it('should load script assets successfully', async () => {
      const result = await loader.load('script', 'asset://test-script.js');
      
      expect(result).toBeDefined();
      expect(mockWorld.scripts.evaluate).toHaveBeenCalledWith('console.log("test script");');
    });

    it('should reject forbidden script types', async () => {
      (global.fetch as any).mockImplementation(() => 
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve('app.create("video", {});')
        })
      );

      const result = await loader.load('script', 'asset://forbidden-script.js');
      expect(result).toBeUndefined();
    });

    it('should handle network errors', async () => {
      (global.fetch as any).mockImplementation(() => 
        Promise.resolve({ ok: false, status: 404 })
      );

      await expect(loader.load('model', 'asset://missing.glb')).rejects.toThrow();
    });

    it('should cache loaded assets', async () => {
      await loader.load('model', 'asset://test-model.glb');
      
      expect(loader.has('model', 'asset://test-model.glb')).toBe(true);
      expect(loader.get('model', 'asset://test-model.glb')).toBeDefined();
    });

    it('should return same promise for concurrent requests', async () => {
      // Call load multiple times for the same resource
      const promise1 = loader.load('model', 'asset://test-model.glb');
      const promise2 = loader.load('model', 'asset://test-model.glb');
      const promise3 = loader.load('model', 'asset://test-model.glb');

      // Ensure they are the same promise object
      expect(promise1).toBe(promise2);
      expect(promise2).toBe(promise3);

      // Wait for the promises to resolve (or reject)
      await Promise.allSettled([promise1, promise2, promise3]);

      // Check that fetch was only called once
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith('https://test-assets.hyperfy.com/test-model.glb');
    });
  });

  describe('GLB Parsing', () => {
    it('should parse model GLB correctly', async () => {
      (globalThis as any).__currentMockGlbType = 'model';
      const arrayBuffer = new ArrayBuffer(1024);
      const result = await loader.parseGLB('model', 'test-key', arrayBuffer, 'test-url');
      
      expect(result.gltf).toMatchObject(createMockGLBData('model'));
      expect(result.toNodes).toBeInstanceOf(Function);
      expect(loader.gltfLoader.parse).toHaveBeenCalledWith(
        arrayBuffer,
        '',
        expect.any(Function),
        expect.any(Function)
      );
    });

    it('should parse emote GLB correctly', async () => {
      (globalThis as any).__currentMockGlbType = 'emote';
      const arrayBuffer = new ArrayBuffer(1024);
      const result = await loader.parseGLB('emote', 'test-key', arrayBuffer, 'test-url');
      
      expect(result.gltf).toMatchObject(createMockGLBData('emote'));
      expect(result.toClip).toBeInstanceOf(Function);
    });

    it('should parse avatar GLB correctly', async () => {
      (globalThis as any).__currentMockGlbType = 'avatar';
      const arrayBuffer = new ArrayBuffer(1024);
      const result = await loader.parseGLB('avatar', 'test-key', arrayBuffer, 'test-url');
      
      expect(result.gltf).toMatchObject(createMockGLBData('avatar'));
      expect(result.factory).toBeDefined();
      expect(result.toNodes).toBeInstanceOf(Function);
    });

    it('should handle avatar GLB without VRM data', async () => {
      const nonVRMGLB = {
        scene: new THREE.Scene(),
        animations: [],
        userData: {}
      }; // This mock needs to be more robust if createVRMFactory is called.
      
      vi.spyOn(loader.gltfLoader, 'parse').mockImplementation(
        (arrayBuffer: ArrayBuffer, path: string, onLoad: (gltf: unknown) => void) => {
          setTimeout(() => onLoad(nonVRMGLB), 10);
        }
      );

      const arrayBuffer = new ArrayBuffer(1024);
      const result = await loader.parseGLB('avatar', 'test-key', arrayBuffer, 'test-url');
      
      expect(result.factory).toBeNull();
    });

    it('should reject unsupported GLB types', async () => {
      const arrayBuffer = new ArrayBuffer(1024);
      
      await expect(
        loader.parseGLB('unsupported', 'test-key', arrayBuffer, 'test-url')
      ).rejects.toThrow('[AgentLoader] Unsupported GLTF type: unsupported');
    });

    it('should handle GLTFLoader parse errors', async () => {
      vi.spyOn(loader.gltfLoader, 'parse').mockImplementation(
        (arrayBuffer: ArrayBuffer, path: string, onLoad: any, onError: (error: Error) => void) => {
          setTimeout(() => onError(new Error('Parse failed')), 10);
        }
      );

      const arrayBuffer = new ArrayBuffer(1024);
      
      await expect(
        loader.parseGLB('model', 'test-key', arrayBuffer, 'test-url')
      ).rejects.toThrow('Parse failed');
    });
  });

  describe('Emote Clip Generation', () => {
    it('should generate clip with correct options', async () => {
      (globalThis as any).__currentMockGlbType = 'emote';
      const result = await loader.load('emote', 'asset://test-emote.glb');
      
      const clipOptions = {
        rootToHips: 1.5,
        version: '1.0',
        getBoneName: (vrmBoneName: string) => `bone_${vrmBoneName}`
      };
      
      const clip = result?.toClip?.(clipOptions);
      expect(clip).toBeInstanceOf(THREE.AnimationClip);
    });
  });

  describe('Preload Methods (No-op)', () => {
    it('should handle preload calls gracefully', () => {
      expect(() => loader.preload('model', 'test.glb')).not.toThrow();
    });

    it('should handle execPreload calls gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      
      expect(() => loader.execPreload()).not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith('[AgentLoader] execPreload called (No-op).');
      
      consoleSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    it('should handle URL resolution errors', async () => {
      await expect(
        loader.load('model', 'invalid-scheme://test.glb')
      ).rejects.toThrow('[AgentLoader] Could not resolve URL');
    });

    it('should clean up promises on fetch errors', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));
      
      const promise = loader.load('model', 'asset://test.glb');
      await expect(promise).rejects.toThrow('Network error');
      
      // Promise should be removed from cache after error
      expect(loader.promises.has('model/asset://test.glb')).toBe(false);
    });
  });
}); 