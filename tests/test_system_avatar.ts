/**
 * Comprehensive test suite for AgentAvatar system
 * Tests avatar loading, emote handling, property management, and proxy behavior
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { AgentAvatar } from '../src/hyperfy/systems/avatar.js';
import { Node } from '../src/hyperfy/core/nodes/Node.js';
import type { AvatarFactory, AvatarInstance } from '../src/types/index.js';

// Extended interface for testing
interface ExtendedAvatar extends AgentAvatar {
  name: string;
  ctx: {
    world: {
      stage: { dirtyNodes: Set<Node> };
      loader?: {
        get(type: string, url: string): { factory?: AvatarFactory; hooks?: unknown } | undefined;
        load(type: string, url: string): Promise<{ factory?: AvatarFactory; hooks?: unknown } | undefined>;
      };
      setHot?: (instance: unknown, value: boolean) => void;
    };
  } | null;
  matrixWorld: THREE.Matrix4;
  parent: Node & { position?: THREE.Vector3 } | null;
}

// Mock avatar factory for testing
const createMockAvatarFactory = (): AvatarFactory => ({
  create: vi.fn((matrixWorld: THREE.Matrix4, hooks: unknown, avatarNode: unknown) => {
    const mockInstance: AvatarInstance = {
      move: vi.fn(),
      destroy: vi.fn(),
      setEmote: vi.fn(),
      height: 1.8,
      headToHeight: 0.2,
    };
    return mockInstance;
  }),
  applyStats: vi.fn(),
});

// Mock loaded avatar data
const createMockLoadedAvatar = (factory?: AvatarFactory) => ({
  factory: factory || createMockAvatarFactory(),
  hooks: { testHook: 'value' },
});

// Mock world context with proper structure
const createMockWorldContext = () => {
  const mockLoader = {
    get: vi.fn(),
    load: vi.fn(),
  };

  return {
    world: {
      stage: {
        dirtyNodes: new Set<Node>(),
      },
      loader: mockLoader,
      setHot: vi.fn(),
    },
  };
};

describe('AgentAvatar System', () => {
  let avatar: AgentAvatar;
  let mockWorldContext: ReturnType<typeof createMockWorldContext>;
  let mockFactory: AvatarFactory;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockFactory = createMockAvatarFactory();
    mockWorldContext = createMockWorldContext();
    
    avatar = new AgentAvatar({
      id: 'test-avatar',
      src: 'asset://test-avatar.vrm',
      emote: undefined, // Use undefined instead of null
    });
    
    // Set up the context with proper typing
    (avatar as ExtendedAvatar).ctx = mockWorldContext;
    (avatar as ExtendedAvatar).matrixWorld = new THREE.Matrix4();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with default values', () => {
      const defaultAvatar = new AgentAvatar();
      
      expect(defaultAvatar).toBeInstanceOf(AgentAvatar);
      expect(defaultAvatar).toBeInstanceOf(Node);
      expect(defaultAvatar.src).toBeNull();
      expect(defaultAvatar.emote).toBeNull();
      expect(defaultAvatar.onLoad).toBeNull();
      expect(defaultAvatar.factory).toBeNull();
      expect(defaultAvatar.hooks).toBeNull();
      expect(defaultAvatar.instance).toBeNull();
    });

    it('should initialize with provided data', () => {
      const onLoadCallback = vi.fn();
      const testAvatar = new AgentAvatar({
        id: 'custom-avatar',
        src: 'asset://custom.vrm',
        emote: 'asset://wave.glb',
        onLoad: onLoadCallback,
        factory: mockFactory,
        hooks: { custom: 'hook' },
      });

      expect(testAvatar.id).toBe('custom-avatar');
      expect(testAvatar.src).toBe('asset://custom.vrm');
      expect(testAvatar.emote).toBe('asset://wave.glb');
      expect(testAvatar.onLoad).toBe(onLoadCallback);
      expect(testAvatar.factory).toBe(mockFactory);
      expect(testAvatar.hooks).toEqual({ custom: 'hook' });
    });

    it('should set name property to "avatar"', () => {
      expect((avatar as ExtendedAvatar).name).toBe('avatar');
    });
  });

  describe('Property Getters and Setters', () => {
    describe('src property', () => {
      it('should get and set src correctly', () => {
        expect(avatar.src).toBe('asset://test-avatar.vrm');
        
        avatar.src = 'asset://new-avatar.vrm';
        expect(avatar.src).toBe('asset://new-avatar.vrm');
      });

      it('should allow setting src to null', () => {
        avatar.src = null;
        expect(avatar.src).toBeNull();
      });

      it('should throw error for non-string src', () => {
        expect(() => {
          avatar.src = 123 as unknown as string;
        }).toThrow('[avatar] src not a string');
      });

      it('should trigger rebuild when src changes', () => {
        const setDirtySpy = vi.spyOn(avatar, 'setDirty');
        
        avatar.src = 'asset://different-avatar.vrm';
        
        expect(setDirtySpy).toHaveBeenCalled();
      });

      it('should not trigger rebuild when src is the same', () => {
        const setDirtySpy = vi.spyOn(avatar, 'setDirty');
        
        avatar.src = 'asset://test-avatar.vrm'; // Same as initial
        
        expect(setDirtySpy).not.toHaveBeenCalled();
      });
    });

    describe('emote property', () => {
      it('should get and set emote correctly', () => {
        avatar.emote = 'asset://dance.glb';
        expect(avatar.emote).toBe('asset://dance.glb');
      });

      it('should allow setting emote to null', () => {
        avatar.emote = null;
        expect(avatar.emote).toBeNull();
      });

      it('should handle non-string emote gracefully', () => {
        expect(() => {
          avatar.emote = 123 as unknown as string;
        }).not.toThrow();
        
        // Should not change the emote value
        expect(avatar.emote).toBeNull();
      });

      it('should call instance.setEmote when emote changes', async () => {
        // Set up avatar with instance
        mockWorldContext.world.loader.get.mockReturnValue(createMockLoadedAvatar(mockFactory));
        await avatar.mount();
        
        const mockInstance = avatar.instance as AvatarInstance;
        
        avatar.emote = 'asset://wave.glb';
        
        expect(mockInstance.setEmote).toHaveBeenCalledWith('asset://wave.glb');
      });
    });

    describe('onLoad property', () => {
      it('should get and set onLoad callback', () => {
        const callback = vi.fn();
        
        avatar.onLoad = callback;
        expect(avatar.onLoad).toBe(callback);
      });

      it('should allow setting onLoad to null', () => {
        avatar.onLoad = null;
        expect(avatar.onLoad).toBeNull();
      });
    });

    describe('height property', () => {
      it('should return height from instance', async () => {
        mockWorldContext.world.loader.get.mockReturnValue(createMockLoadedAvatar(mockFactory));
        await avatar.mount();
        
        expect(avatar.height).toBe(1.8);
        expect(avatar.getHeight()).toBe(1.8);
      });

      it('should return null when no instance', () => {
        expect(avatar.height).toBeNull();
        expect(avatar.getHeight()).toBeNull();
      });
    });
  });

  describe('Avatar Loading and Mounting', () => {
    it('should mount avatar with cached factory', async () => {
      const mockLoadedAvatar = createMockLoadedAvatar(mockFactory);
      mockWorldContext.world.loader.get.mockReturnValue(mockLoadedAvatar);
      
      await avatar.mount();
      
      expect(mockWorldContext.world.loader.get).toHaveBeenCalledWith('avatar', 'asset://test-avatar.vrm');
      expect(avatar.factory).toBe(mockFactory);
      expect(avatar.hooks).toBe(mockLoadedAvatar.hooks);
      expect(avatar.instance).toBeDefined();
      expect(mockFactory.create).toHaveBeenCalled();
    });

    it('should load avatar when not cached', async () => {
      const mockLoadedAvatar = createMockLoadedAvatar(mockFactory);
      mockWorldContext.world.loader.get.mockReturnValue(undefined);
      mockWorldContext.world.loader.load.mockResolvedValue(mockLoadedAvatar);
      
      await avatar.mount();
      
      expect(mockWorldContext.world.loader.get).toHaveBeenCalledWith('avatar', 'asset://test-avatar.vrm');
      expect(mockWorldContext.world.loader.load).toHaveBeenCalledWith('avatar', 'asset://test-avatar.vrm');
      expect(avatar.factory).toBe(mockFactory);
      expect(avatar.instance).toBeDefined();
    });

    it('should handle mount without src', async () => {
      avatar.src = null;
      
      await avatar.mount();
      
      expect(mockWorldContext.world.loader.get).not.toHaveBeenCalled();
      expect(avatar.factory).toBeNull();
      expect(avatar.instance).toBeNull();
    });

    it('should call onLoad callback after mounting', async () => {
      const onLoadCallback = vi.fn();
      avatar.onLoad = onLoadCallback;
      
      mockWorldContext.world.loader.get.mockReturnValue(createMockLoadedAvatar(mockFactory));
      
      await avatar.mount();
      
      expect(onLoadCallback).toHaveBeenCalled();
    });

    it('should set hot instance after mounting', async () => {
      mockWorldContext.world.loader.get.mockReturnValue(createMockLoadedAvatar(mockFactory));
      
      await avatar.mount();
      
      expect(mockWorldContext.world.setHot).toHaveBeenCalledWith(avatar.instance, true);
    });

    it('should handle concurrent mount calls', async () => {
      mockWorldContext.world.loader.get.mockReturnValue(undefined);
      mockWorldContext.world.loader.load.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(createMockLoadedAvatar(mockFactory)), 50))
      );
      
      // Start multiple mount operations
      const promise1 = avatar.mount();
      const promise2 = avatar.mount();
      
      await Promise.all([promise1, promise2]);
      
      // Should only load once due to the isLoading flag
      expect(mockWorldContext.world.loader.load).toHaveBeenCalledTimes(1);
    });
  });

  describe('Avatar Unmounting', () => {
    beforeEach(async () => {
      // Set up mounted avatar
      mockWorldContext.world.loader.get.mockReturnValue(createMockLoadedAvatar(mockFactory));
      await avatar.mount();
    });

    it('should unmount avatar instance', () => {
      const mockInstance = avatar.instance as AvatarInstance;
      
      avatar.unmount();
      
      expect(mockWorldContext.world.setHot).toHaveBeenCalledWith(mockInstance, false);
      expect(mockInstance.destroy).toHaveBeenCalled();
      expect(avatar.instance).toBeNull();
    });

    it('should handle unmount without instance', () => {
      avatar.instance = null;
      
      expect(() => avatar.unmount()).not.toThrow();
      expect(mockWorldContext.world.setHot).not.toHaveBeenCalledWith(expect.anything(), false);
    });
  });

  describe('Commit and Updates', () => {
    beforeEach(async () => {
      mockWorldContext.world.loader.get.mockReturnValue(createMockLoadedAvatar(mockFactory));
      await avatar.mount();
    });

    it('should rebuild when needsRebuild is true', async () => {
      const unmountSpy = vi.spyOn(avatar, 'unmount');
      const mountSpy = vi.spyOn(avatar, 'mount');
      
      // Trigger rebuild by changing src
      avatar.src = 'asset://new-avatar.vrm';
      
      await avatar.commit(false);
      
      expect(unmountSpy).toHaveBeenCalled();
      expect(mountSpy).toHaveBeenCalled();
    });

    it('should move instance when didMove is true', () => {
      const mockInstance = avatar.instance as AvatarInstance;
      const extendedAvatar = avatar as ExtendedAvatar;
      
      avatar.commit(true);
      
      expect(mockInstance.move).toHaveBeenCalledWith(extendedAvatar.matrixWorld);
    });

    it('should not move instance when didMove is false', () => {
      const mockInstance = avatar.instance as AvatarInstance;
      
      avatar.commit(false);
      
      expect(mockInstance.move).not.toHaveBeenCalled();
    });
  });

  describe('Bone Transform and Positioning', () => {
    it('should return bone transform matrix', () => {
      const matrix = avatar.getBoneTransform('head');
      
      expect(matrix).toBeInstanceOf(THREE.Matrix4);
    });

    it('should use parent position for bone transform', () => {
      const mockParent = {
        position: new THREE.Vector3(1, 2, 3),
      };
      (avatar as ExtendedAvatar).parent = mockParent as Node & { position?: THREE.Vector3 };
      
      const matrix = avatar.getBoneTransform('head');
      const position = new THREE.Vector3();
      matrix.decompose(position, new THREE.Quaternion(), new THREE.Vector3());
      
      expect(position.x).toBe(1);
      expect(position.y).toBe(2);
      expect(position.z).toBe(3);
    });

    it('should return identity matrix when no parent', () => {
      (avatar as ExtendedAvatar).parent = null;
      
      const matrix = avatar.getBoneTransform('head');
      const position = new THREE.Vector3();
      matrix.decompose(position, new THREE.Quaternion(), new THREE.Vector3());
      
      expect(position.x).toBe(0);
      expect(position.y).toBe(0);
      expect(position.z).toBe(0);
    });
  });

  describe('Emote Methods', () => {
    beforeEach(async () => {
      mockWorldContext.world.loader.get.mockReturnValue(createMockLoadedAvatar(mockFactory));
      await avatar.mount();
    });

    it('should set emote using setEmote method', () => {
      avatar.setEmote('asset://dance.glb');
      
      expect(avatar.emote).toBe('asset://dance.glb');
    });

    it('should call instance setEmote when using setEmote method', () => {
      const mockInstance = avatar.instance as AvatarInstance;
      
      avatar.setEmote('asset://wave.glb');
      
      expect(mockInstance.setEmote).toHaveBeenCalledWith('asset://wave.glb');
    });
  });

  describe('Stats and Factory Methods', () => {
    it('should apply stats to factory', () => {
      avatar.factory = mockFactory;
      const testStats = { health: 100, level: 5 };
      
      avatar.applyStats(testStats);
      
      expect(mockFactory.applyStats).toHaveBeenCalledWith(testStats);
    });

    it('should handle applyStats without factory', () => {
      avatar.factory = null;
      
      expect(() => avatar.applyStats({ test: 'stats' })).not.toThrow();
    });

    it('should handle factory without applyStats method', () => {
      avatar.factory = { create: vi.fn() } as Partial<AvatarFactory> as AvatarFactory;
      
      expect(() => avatar.applyStats({ test: 'stats' })).not.toThrow();
    });
  });

  describe('Copy Method', () => {
    it('should copy avatar properties', () => {
      const sourceAvatar = new AgentAvatar({
        src: 'asset://source.vrm',
        emote: 'asset://source-emote.glb',
        onLoad: vi.fn(),
        factory: mockFactory,
        hooks: { source: 'hooks' },
      });
      
      const targetAvatar = new AgentAvatar();
      targetAvatar.copy(sourceAvatar, false);
      
      expect(targetAvatar.src).toBe('asset://source.vrm');
      expect(targetAvatar.emote).toBe('asset://source-emote.glb');
      expect(targetAvatar.onLoad).toBe(sourceAvatar.onLoad);
      expect(targetAvatar.factory).toBe(mockFactory);
      expect(targetAvatar.hooks).toEqual({ source: 'hooks' });
    });
  });

  describe('Proxy Behavior', () => {
    it('should create and return proxy object', () => {
      const proxy = avatar.getProxy();
      
      expect(proxy).toBeDefined();
      expect(typeof proxy.src).toBe('string');
      expect(proxy.emote).toBeNull();
      expect(typeof proxy.getHeight).toBe('function');
      expect(typeof proxy.setEmote).toBe('function');
    });

    it('should return same proxy on subsequent calls', () => {
      const proxy1 = avatar.getProxy();
      const proxy2 = avatar.getProxy();
      
      expect(proxy1).toBe(proxy2);
    });

    it('should proxy src property correctly', () => {
      const proxy = avatar.getProxy();
      
      expect(proxy.src).toBe('asset://test-avatar.vrm');
      
      proxy.src = 'asset://proxy-avatar.vrm';
      expect(avatar.src).toBe('asset://proxy-avatar.vrm');
      expect(proxy.src).toBe('asset://proxy-avatar.vrm');
    });

    it('should proxy emote property correctly', () => {
      const proxy = avatar.getProxy();
      
      proxy.emote = 'asset://proxy-emote.glb';
      expect(avatar.emote).toBe('asset://proxy-emote.glb');
      expect(proxy.emote).toBe('asset://proxy-emote.glb');
    });

    it('should proxy onLoad property correctly', () => {
      const proxy = avatar.getProxy();
      const callback = vi.fn();
      
      proxy.onLoad = callback;
      expect(avatar.onLoad).toBe(callback);
      expect(proxy.onLoad).toBe(callback);
    });

    it('should proxy height property correctly', async () => {
      mockWorldContext.world.loader.get.mockReturnValue(createMockLoadedAvatar(mockFactory));
      await avatar.mount();
      
      const proxy = avatar.getProxy();
      
      expect(proxy.height).toBe(1.8);
      expect(proxy.getHeight()).toBe(1.8);
    });

    it('should proxy getHeadToHeight method correctly', async () => {
      mockWorldContext.world.loader.get.mockReturnValue(createMockLoadedAvatar(mockFactory));
      await avatar.mount();
      
      const proxy = avatar.getProxy();
      
      expect(proxy.getHeadToHeight()).toBe(0.2);
    });

    it('should proxy getBoneTransform method correctly', () => {
      const proxy = avatar.getProxy();
      
      const matrix = proxy.getBoneTransform('head');
      expect(matrix).toBeInstanceOf(THREE.Matrix4);
    });

    it('should proxy setEmote method correctly', async () => {
      mockWorldContext.world.loader.get.mockReturnValue(createMockLoadedAvatar(mockFactory));
      await avatar.mount();
      
      const proxy = avatar.getProxy();
      const mockInstance = avatar.instance as AvatarInstance;
      
      proxy.setEmote('asset://proxy-dance.glb');
      
      expect(avatar.emote).toBe('asset://proxy-dance.glb');
      expect(mockInstance.setEmote).toHaveBeenCalledWith('asset://proxy-dance.glb');
    });
  });

  describe('Error Handling', () => {
    it('should handle loader errors gracefully', async () => {
      mockWorldContext.world.loader.get.mockReturnValue(undefined);
      mockWorldContext.world.loader.load.mockRejectedValue(new Error('Load failed'));
      
      // Should not throw, but handle error gracefully
      await avatar.mount();
      expect(avatar.instance).toBeNull();
      expect(avatar.factory).toBeNull();
    });

    it('should handle missing world context', async () => {
      (avatar as ExtendedAvatar).ctx = null;
      
      await avatar.mount();
      expect(avatar.instance).toBeNull();
    });

    it('should handle missing loader in context', async () => {
      (avatar as ExtendedAvatar).ctx = { 
        world: { 
          stage: { dirtyNodes: new Set() }
        } 
      };
      
      await avatar.mount();
      expect(avatar.instance).toBeNull();
    });
  });

  describe('Hot Loading Test', () => {
    it('should support hot reloading of avatar assets', async () => {
      // Initial load
      const initialFactory = createMockAvatarFactory();
      mockWorldContext.world.loader.get.mockReturnValue(createMockLoadedAvatar(initialFactory));
      
      await avatar.mount();
      expect(avatar.factory).toBe(initialFactory);
      expect(avatar.instance).toBeDefined();
      
      const initialInstance = avatar.instance;
      
      // Simulate hot reload with new factory
      const newFactory = createMockAvatarFactory();
      mockWorldContext.world.loader.get.mockReturnValue(createMockLoadedAvatar(newFactory));
      
      // Trigger hot reload by changing src
      avatar.src = 'asset://hot-reloaded-avatar.vrm';
      
      // Commit should trigger rebuild
      await avatar.commit(false);
      
      // Should have new factory and instance
      expect(avatar.factory).toBe(newFactory);
      expect(avatar.instance).not.toBe(initialInstance);
      expect(avatar.instance).toBeDefined();
      
      // Old instance should have been destroyed
      expect((initialInstance as AvatarInstance).destroy).toHaveBeenCalled();
    });

    it('should handle hot reload with setHot calls', async () => {
      mockWorldContext.world.loader.get.mockReturnValue(createMockLoadedAvatar(mockFactory));
      
      await avatar.mount();
      
      const instance = avatar.instance;
      
      // Verify setHot was called with true during mount
      expect(mockWorldContext.world.setHot).toHaveBeenCalledWith(instance, true);
      
      // Unmount should call setHot with false
      avatar.unmount();
      expect(mockWorldContext.world.setHot).toHaveBeenCalledWith(instance, false);
    });

    it('should maintain emote state during hot reload', async () => {
      mockWorldContext.world.loader.get.mockReturnValue(createMockLoadedAvatar(mockFactory));
      
      await avatar.mount();
      
      // Set an emote
      avatar.emote = 'asset://dance.glb';
      
      // Trigger hot reload
      avatar.src = 'asset://hot-reloaded-avatar.vrm';
      await avatar.commit(false);
      
      // Emote should be preserved and applied to new instance
      expect(avatar.emote).toBe('asset://dance.glb');
      expect((avatar.instance as AvatarInstance).setEmote).toHaveBeenCalledWith('asset://dance.glb');
    });
  });
}); 